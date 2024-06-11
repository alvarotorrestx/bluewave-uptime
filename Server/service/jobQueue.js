const { Queue, Worker, Job } = require("bullmq");
const QUEUE_NAME = "monitors";
const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};
const JOBS_PER_WORKER = 5;
const logger = require("../utils/logger");

class JobQueue {
  /**
   * Constructs a new JobQueue
   * @constructor
   * @throws {Error}
   */
  constructor() {
    this.queue = new Queue(QUEUE_NAME, {
      connection,
    });
    this.workers = [];
  }

  /**
   * Static factory method to create a JobQueue
   * @static
   * @async
   * @returns {Promise<JobQueue>} - Returns a new JobQueue
   *
   */
  static async createJobQueue() {
    const queue = new JobQueue();
    try {
      const workerStats = await queue.getWorkerStats();
      await queue.scaleWorkers(workerStats);
      return queue;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Creates a worker for the queue
   * Operations are carried out in the async callback
   * @returns {Worker} The newly created worker
   */
  createWorker() {
    const worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        // TODO Ping a monitor
        console.log(`${job.name} completed, workers: ${this.workers.length}`);
      },
      {
        connection,
      }
    );
    return worker;
  }

  /**
   * @typedef {Object} WorkerStats
   * @property {Array<Job>} jobs - Array of jobs in the Queue
   * @property {number} - workerLoad - The number of jobs per worker
   *
   */

  /**
   * Gets stats related to the workers
   * This is used for scaling workers right now
   * In the future we will likely want to scale based on server performance metrics
   * CPU Usage & memory usage, if too high, scale down workers.
   * When to scale up?  If jobs are taking too long to complete?
   * @async
   * @returns {Promise<WorkerStats>} - Returns the worker stats
   */
  async getWorkerStats() {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      const load = jobs.length / this.workers.length;
      return { jobs, load };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Scale Workers
   * This function scales workers based on the load per worker
   * If the load is higher than the JOBS_PER_WORKER threshold, we add more workers
   * If the load is lower than the JOBS_PER_WORKER threshold, we release workers
   * This approach ignores server performance, which we should add in the future
   *

   * @async
   * @param {WorkerStats} workerStats - The payload for the job.
   * @returns {Promise<boolean>}
   */
  async scaleWorkers(workerStats) {
    if (this.workers.length === 0) {
      // There are no workers, need to add one
      const worker = this.createWorker();
      this.workers.push(worker);
      return true;
    }

    if (workerStats.load > JOBS_PER_WORKER) {
      // Find out how many more jobs we have than current workers can handle
      const excessJobs =
        workerStats.jobs.length - this.workers.length * JOBS_PER_WORKER;

      // Divide by jobs/worker to find out how many workers to add
      const workersToAdd = Math.ceil(excessJobs / JOBS_PER_WORKER);
      for (let i = 0; i < workersToAdd; i++) {
        const worker = this.createWorker();
        this.workers.push(worker);
      }
      return true;
    }

    if (workerStats.load < JOBS_PER_WORKER) {
      // Find out how much excess capacity we have
      const workerCapacity = this.workers.length * JOBS_PER_WORKER;
      const excessCapacity = workerCapacity - workerStats.jobs.length;
      // Calculate how many workers to remove
      const workersToRemove = Math.floor(excessCapacity / JOBS_PER_WORKER);
      for (let i = 0; i < workersToRemove; i++) {
        const worker = this.workers.pop();
        try {
          await worker.close();
        } catch (error) {
          // Catch the error instead of throwing it
          console.error("Error closing worker", error);
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Gets all jobs in the queue.
   *
   * @async
   * @returns {Promise<Array<Job>>}
   * @throws {Error} - Throws error if getting jobs fails
   */
  async getJobs() {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      console.log("jobs", jobs);
      return jobs;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Adds a job to the queue and scales workers based on worker stats.
   *
   * @async
   * @param {string} jobName - The name of the job to be added.
   * @param {Monitor} payload - The payload for the job.
   * @throws {Error} - Will throw an error if the job cannot be added or workers don't scale
   */
  async addJob(jobName, payload) {
    try {
      await this.queue.add(jobName, payload, {
        repeat: {
          every: 1000,
          limit: 100,
        },
      });
      const workerStats = await this.getWorkerStats();
      await this.scaleWorkers(workerStats);
    } catch (error) {
      throw error;
    }
  }

  /**
   * @async
   * @returns {Promise<boolean>} - Returns true if obliteration is successful
   */
  async obliterate() {
    try {
      await this.queue.obliterate();
      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = JobQueue;
