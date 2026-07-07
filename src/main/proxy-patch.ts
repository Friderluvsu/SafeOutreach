import { SocksClient } from 'socks';
import Module from 'node:module';

const originalRequire = Module.prototype.require;


(Module.prototype as any).require = function (id: string) {
  if (id === 'socks') {
    
    return { SocksClient };
  }
  return originalRequire.apply(this, arguments as any);
};