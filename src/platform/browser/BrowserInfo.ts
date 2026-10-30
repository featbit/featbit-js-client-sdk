import { IInfo, IPlatformData, ISdkData } from "../IInfo.js";
import { name, version } from '../../version.js';


export default class BrowserInfo implements IInfo {
  get appType(): string {
    return 'Browser-Client-SDK';
  }

  platformData(): IPlatformData {
    return {
      os: {},
      name: 'Browser',
      additional: {},
    };
  }

  sdkData(): ISdkData {
    return {
      name: name,
      version: version,
      userAgent: `${ this.appType }/${ version }`,
    };
  }
}