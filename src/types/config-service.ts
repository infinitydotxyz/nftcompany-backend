import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './environment-variables.interface';

export type ConfigServiceType = ConfigService<EnvironmentVariables>;
