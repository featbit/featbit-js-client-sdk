import {FeatureFlagValue, ICSS, IOption, IUser, UrlMatchType, VariationDataType} from "./types";
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

/******************** draggable begin ************************/
export function makeElementDraggable(el) {
  el.addEventListener('mousedown', function(this: HTMLElement, e) {
    var offsetX = e.clientX - parseInt(window.getComputedStyle(this).left);
    var offsetY = e.clientY - parseInt(window.getComputedStyle(this).top);
    
    function mouseMoveHandler(e) {
      e.preventDefault();
      el.style.top = (e.clientY - offsetY) + 'px';
      el.style.left = (e.clientX - offsetX) + 'px';
    }

    function reset() {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', reset);
    }

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', reset);
  });
}
/******************** draggable end ************************/

// add style to html element
export function addCss(element: HTMLElement, style: { [key: string]: string }) {
  for (const property in style) {
    element.style[property] = style[property];
  }
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

// test if the current page url mathch the given url
export function isUrlMatch(matchType: UrlMatchType, url: string): boolean {
  const current_page_url = window.location.href;
  if (url === null || url === undefined || url === '') {
    return true;
  }
  
  switch(matchType){
    case UrlMatchType.Substring:
      return current_page_url.includes(url);
    default:
      return false;
  }
}

export function groupBy (xs: any, key: string): {[key: string] : any} {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

export function extractCSS(css: string): ICSS[] {
  return css.trim().replace(/(?:\r\n|\r|\n)/g, ';')
    .replace(/\w*([\W\w])+\{/g, '')
    .replace(/(?:\{|\})/g, '')
    .split(';')
    .filter(c => c.trim() !== '')
    .map(c => {
      const style = c.split(':');
      if (style.length === 2) {
        return {
          name: style[0].trim(),
          value: style[1].trim()
        }
      }
      
      return {
        name: '',
        value: ''
      }
    })
    .filter(s => {
      return s.name !== '' && s.value !== ''
    });
}
