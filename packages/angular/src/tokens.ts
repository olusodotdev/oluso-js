import { InjectionToken } from '@angular/core';
import { OlusoBrowserOptions, OlusoClient } from '@oluso/browser';

export const OLUSO_OPTIONS = new InjectionToken<OlusoBrowserOptions>('OLUSO_OPTIONS');
export const OLUSO_CLIENT = new InjectionToken<OlusoClient>('OLUSO_CLIENT');
