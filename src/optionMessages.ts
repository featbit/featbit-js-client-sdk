export default class OptionMessages {
  static partialEndpoint(name: string): string {
    return `You have set custom uris without specifying the ${ name } URI; connections may not work properly`;
  }

  static invalidParam(name: string): string {
    return `The ${ name } option is not passed in or its value is invalid`;
  }

  static mandatory(name: string): string {
    return `${ name } is mandatory`;
  }
}