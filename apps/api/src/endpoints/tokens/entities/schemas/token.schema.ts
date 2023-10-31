import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiResponseProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type TokenDocument = Token & Document;

@Schema()
export class Token {
  @ApiResponseProperty()
  @Prop({ required: true, unique: true, index: true })
  identifier!: string;

  @ApiResponseProperty()
  @Prop({ required: false, default: null })
  name?: string;
}

export const TokenSchema = SchemaFactory.createForClass(Token);
