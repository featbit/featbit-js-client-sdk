export interface IFbDevice {
  manufacturer?: string;
  model?: string;
  storageBytes?: string;
  memoryBytes?: string;
  os?: {
    /**
     * The family of operating system.
     */
    family?: string;
    name?: string;
    version?: string;
  };
}

/**
 * Information about the platform of the SDK and the environment it is executing.
 */
export interface IPlatformData {
  /**
   * Information about the OS on which the SDK is running. Should be populated
   * when available. Not all platforms will make this data accessible.
   */
  os?: {
    /**
     * The architecture. Ideally at runtime, but may be build time if that is
     * a constraint.
     */
    arch?: string;
    /**
     * The name of the OS. "MacOS", "Windows", or "Linux". If not one of those,
     * then use the value provided by the OS.
     */
    name?: string;

    /** The version of the OS. */
    version?: string;
  };

  /**
   * The name of the platform the SDK is running on. For instance 'Node'.
   */
  name?: string;

  /**
   * Any additional attributes associated with the platform.
   */
  additional?: Record<string, string>;

  /**
   * Device hardware information. Should be populated when available. Not all
   * platforms will have this data.
   */
  fbDevice?: IFbDevice;
}

export interface ISdkData {
  /**
   * The name of the SDK. e.g. "browser-server-sdk"
   */
  name?: string;

  /**
   * The version of the SDK.
   */
  version?: string;

  /**
   * If this is a top-level (not a wrapper) SDK this will be used to create the user agent string.
   * It will take the form 'userAgentBase/version`.
   */
  userAgent?: string;

  /**
   * Name of the wrapper SDK if present.
   */
  wrapperName?: string;
  /**
   * Version of the wrapper if present.
   */
  wrapperVersion?: string;
}

/**
 * Interface for getting information about the SDK or the environment it is
 * executing in.
 */
export interface IInfo {
  /**
   * Get the app type
   */
  get appType(): string;

  /**
   * Get information about the platform.
   */
  platformData(): IPlatformData;

  /**
   * Get information about the SDK implementation.
   */
  sdkData(): ISdkData;
}