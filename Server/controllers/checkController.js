const {
  createCheckParamValidation,
  createCheckBodyValidation,
  getChecksParamValidation,
  deleteChecksParamValidation,
} = require("../validation/joi");
const SERVICE_NAME = "check";

const createCheck = async (req, res, next) => {
  try {
    await createCheckParamValidation.validateAsync(req.params);
    await createCheckBodyValidation.validateAsync(req.body);
  } catch (error) {
    error.status = 422;
    error.service = SERVICE_NAME;
    error.message = error.details[0].message;
    next(error);
    return;
  }

  try {
    const checkData = { ...req.body };
    const check = await req.db.createCheck(checkData);
    return res
      .status(200)
      .json({ success: true, msg: "Check created", data: check });
  } catch (error) {
    error.service = SERVICE_NAME;
    next(error);
  }
};

const getChecks = async (req, res, next) => {
  try {
    await getChecksParamValidation.validateAsync(req.params);
  } catch (error) {
    error.status = 422;
    error.service = SERVICE_NAME;
    error.message = error.details[0].message;
    next(error);
    return;
  }

  try {
    const checks = await req.db.getChecks(req.params.monitorId);
    return res
      .status(200)
      .json({ success: true, msg: "Checks retrieved", data: checks });
  } catch (error) {
    error.service = SERVICE_NAME;
    next(error);
  }
};

const deleteChecks = async (req, res, next) => {
  try {
    await deleteChecksParamValidation.validateAsync(req.params);
  } catch (error) {
    error.status = 422;
    error.service = SERVICE_NAME;
    error.message = error.details[0].message;
    next(error);
    return;
  }

  try {
    const deletedCount = await req.db.deleteChecks(req.params.monitorId);
    return res
      .status(200)
      .json({ success: true, msg: "Checks deleted", data: { deletedCount } });
  } catch (error) {
    error.service = SERVICE_NAME;
    next(error);
  }
};

module.exports = {
  createCheck,
  getChecks,
  deleteChecks,
};
