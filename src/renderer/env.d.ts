/// <reference types="vite/client" />
import type { MermindAPI } from '../shared/types';

declare global {
  interface Window {
    mermindAPI?: MermindAPI;
  }
}

export {};
