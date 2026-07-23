import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Query,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import type { UploadedFileInfo } from './uploaded-file.interface';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 52428800 }), // 50MB max
        ],
      }),
    )
    file: UploadedFileInfo,
    @Query('type') type: string = 'images',
  ) {
    // Validate file types based on type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedModelTypes = ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'];

    if (type === 'images' && !allowedImageTypes.includes(file.mimetype)) {
      return { code: 400, message: '图片格式不支持，仅支持 jpg/png/webp' };
    }
    if (
      type === 'models' &&
      !allowedModelTypes.includes(file.mimetype) &&
      !file.originalname.endsWith('.glb') &&
      !file.originalname.endsWith('.gltf')
    ) {
      return { code: 400, message: '3D 模型格式不支持，仅支持 glb/gltf' };
    }

    return this.fileService.uploadFile(file, type);
  }
}
