import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IAiProvider, GenerateImageOptions, GenerateImageResult } from '../interfaces/ai-provider.interface';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCode } from '../../../common/exceptions/error-codes';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.openai.com/v1/images/generations',
          {
            model: 'dall-e-3',
            prompt: options.prompt,
            n: 1,
            size: options.size || '1024x1024',
            quality: options.quality || 'standard',
          },
          {
            headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
            timeout: 60000,
          },
        ),
      );

      const imageData = response.data.data[0];
      return {
        providerTaskId: imageData.revised_prompt || options.prompt,
        imageUrl: imageData.url,
        status: 'completed',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`OpenAI image generation failed: ${err.message}`, err.stack);
      return {
        providerTaskId: '',
        imageUrl: '',
        status: 'failed',
        errorMessage: 'AI image generation failed. Please try again later.',
      };
    }
  }

  async queryTask(_taskId: string): Promise<GenerateImageResult> {
    throw new BusinessException(ErrorCode.INTERNAL_ERROR, 'DALL-E does not support async task query');
  }
}
