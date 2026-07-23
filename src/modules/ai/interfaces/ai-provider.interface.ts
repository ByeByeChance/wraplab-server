export interface GenerateImageOptions {
  prompt: string;
  style: 'scene' | 'studio' | 'outdoor';
  size?: string;
  quality?: 'standard' | 'hd';
}

export interface GenerateImageResult {
  providerTaskId: string;
  imageUrl: string;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

export interface IAiProvider {
  generateImage(options: GenerateImageOptions): Promise<GenerateImageResult>;
  queryTask(taskId: string): Promise<GenerateImageResult>;
}
