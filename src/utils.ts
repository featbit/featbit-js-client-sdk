import {FeatureFlagValue, IOption, IUser, VariationDataType} from "./types";
import {logger} from "./logger";


// generate default user info
export function generateGuid(): string {
  let guid = localStorage.getItem("fb-guid");
  if (guid) {
    return guid;
  }
  else {
    const id = uuid();
    localStorage.setItem("fb-guid", id);
    return id;
  }
}

export function serializeUser(user: IUser | undefined): string {
  if (!user) {
    return '';
  }

  const builtInProperties = `${user.keyId},${user.name}`;

  const customizedProperties = user.customizedProperties?.map(p => `${p.name}:${p.value}`).join(',');

  return `${builtInProperties},${customizedProperties}`;
}

export function isNumeric(str: string) {
  if (typeof str != "string") return false // we only process strings!
  // @ts-ignore
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
      !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

export function parseVariation(type: VariationDataType, value: string): FeatureFlagValue {
  switch (type) {
    case VariationDataType.string:
      return value;
    case VariationDataType.boolean:
      if (value === 'true') {
        return true;
      }

      if (value === 'false') {
        return false;
      }

      logger.log(`expected boolean value, but got ${value}`);
      return value;
    case VariationDataType.number:
      if (isNumeric(value)) {
        return +value;
      }

      logger.log(`expected numeric value, but got ${value}`);
      return value;
    case VariationDataType.json:
      try {
        return JSON.parse(value);
      }
      catch (e) {
        logger.log(`expected json value, but got ${value}`);
        return value;
      }
    default:
      logger.log(`unexpected variation type ${type} for ${value}`);
      return value;
  }
}

export function uuid(): string {
  let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return uuid;
}

export function validateUser(user: IUser): string | null {
  if (!user) {
    return 'user must be defined';
  }

  const { keyId, name } = user;

  if (keyId === undefined || keyId === null || keyId.trim() === '') {
    return 'keyId is mandatory';
  }

  if (name === undefined || name === null || name.trim() === '') {
    return 'name is mandatory';
  }

  return null;
}

export function validateOption(option: IOption): string | null {
  if (option === undefined || option === null) {
    return 'option is mandatory';
  }

  const { api, secret, anonymous, user, enableDataSync } = option;

  if (enableDataSync && (api === undefined || api === null || api.trim() === '')) {
    return 'api is mandatory in option';
  }

  if (enableDataSync && (secret === undefined || secret === null || secret.trim() === '')) {
    return 'secret is mandatory in option';
  }

  // validate user
  if (!!anonymous === false && !user) {
    return 'user is mandatory when not using anonymous user';
  }

  if (user) {
    return validateUser(user);
  }

  return null;
}

/********************** encode text begin *****************************/
const alphabet = {
  "0": "Q",
  "1": "B",
  "2": "W",
  "3": "S",
  "4": "P",
  "5": "H",
  "6": "D",
  "7": "X",
  "8": "Z",
  "9": "U",
}

function encodeNumber(param: number, length: number): string {
  var s = "000000000000" + param;
  const numberWithLeadingZeros = s.slice(s.length - length);
  return numberWithLeadingZeros.split('').map(n => alphabet[n]).join('');
}

// generate connection token
export function generateConnectionToken(text: string): string {
  text = text.replace(/=*$/, '');
  const timestamp = Date.now();
  const timestampCode = encodeNumber(timestamp, timestamp.toString().length);
  // get random number less than the length of the text as the start point, and it must be greater or equal to 2
  const start = Math.max(Math.floor(Math.random() * text.length), 2);

  return `${encodeNumber(start, 3)}${encodeNumber(timestampCode.length, 2)}${text.slice(0, start)}${timestampCode}${text.slice(start)}`;
}

/********************** encode text end *****************************/
