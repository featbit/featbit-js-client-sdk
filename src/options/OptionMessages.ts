/**
 * Messages for issues which can be encountered from processing the configuration options.
 */
export default class OptionMessages {
  static optionBelowMinimum(name: string, value: number, min: number): string {
    return `Config option "${ name }" had invalid value of ${ value }, using minimum of ${ min } instead`;
  }

  static unknownOption(name: string): string {
    return `Ignoring unknown config option "${ name }"`;
  }

  static wrongOptionType(name: string, expectedType: string, actualType: string): string {
    return `Config option "${ name }" should be of type ${ expectedType }, got ${ actualType }, using default value`;
  }

  static wrongOptionTypeBoolean(name: string, actualType: string): string {
    return `Config option "${ name }" should be a boolean, got ${ actualType }, converting to boolean`;
  }

  static partialEndpoint(name: string): string {
    return `You have set custom uris without specifying the ${ name } URI; connections may not work properly`;
  }

  static mandatory(name: string): string {
    return `${ name } is mandatory`;
  }

  static invalidOptionValue(name: string): string {
    return `Invalid option value: ${ name }`;
  }

  static missingKeyInBootstrapValue(key: string): string {
    return `Missing key "${ key }" in bootstrap value`;
  }
}