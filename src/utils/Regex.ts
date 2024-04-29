import { isNullOrUndefined } from "./isNullOrUndefined";

export class Regex {
  private static patternWithFlags = /\/(.*)\/([a-z]*)/i;
  private static whiteSpaceRegex = /\s/g;

  static fromString(patternString: string): RegExp {
    let flags = '';
    const match = patternString.match(Regex.patternWithFlags);

    if (match) {
      patternString = match[1]; // Update the pattern string
      flags = match[2]; // Update the flags
    }

    return new RegExp(patternString, flags);
  }

  static isNullOrWhiteSpace(str: string) {
    return isNullOrUndefined(str) || !str.replace(Regex.whiteSpaceRegex, '').length;
  }
}