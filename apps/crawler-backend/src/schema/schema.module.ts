import { Module } from '@nestjs/common';
import { SchemaService } from './schema.service';

@Module({
  imports: [],
  controllers: [],
  providers: [SchemaService],
})
export class SchemaModule {}
