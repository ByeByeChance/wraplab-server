import { Injectable, Optional, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Optional() @InjectQueue('ai-generation') public readonly aiGenerationQueue?: Queue,
    @Optional() @InjectQueue('notification') public readonly notificationQueue?: Queue,
    @Optional() @InjectQueue('scheduled-task') public readonly scheduledTaskQueue?: Queue,
  ) {}

  async add(queueName: string, jobName: string, data: Record<string, unknown>, opts?: Record<string, unknown>): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.warn(`Queue "${queueName}" not available (test mode?), skipping job [${jobName}]`);
      return null;
    }
    const job = await queue.add(jobName, data, opts as any);
    this.logger.log(`Job ${job.id} added to queue "${queueName}" [${jobName}]`);
    return job;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null | undefined> {
    const queue = this.getQueue(queueName);
    if (!queue) return null;
    return queue.getJob(jobId);
  }

  private getQueue(name: string): Queue | undefined {
    switch (name) {
      case 'ai-generation': return this.aiGenerationQueue;
      case 'notification': return this.notificationQueue;
      case 'scheduled-task': return this.scheduledTaskQueue;
      default: return undefined;
    }
  }
}
