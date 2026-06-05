import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class ProcesarSolicitudDto {
  @IsString()
  @IsNotEmpty({ message: 'id_solicitud es obligatorio' })
  id_solicitud!: string;

  @IsString()
  @IsOptional()
  fecha?: string;

  @IsString()
  @IsOptional()
  canal?: string;

  @IsString()
  @IsOptional()
  tipo_cliente?: string;

  @IsString()
  @IsOptional()
  nombre_cliente?: string;

  @IsString()
  @IsNotEmpty({ message: 'mensaje es obligatorio' })
  mensaje!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsIn(['alta', 'media', 'baja', ''], {
    message: 'prioridad_reportada debe ser alta, media, baja o vacía',
  })
  prioridad_reportada?: string;
}
