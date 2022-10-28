# JavaScript client side SDK


## Introduction
This is the JavaScript client side SDK for the feature management platform Featbit. We will document all the methods available in this SDK, and detail how they work.

Be aware, this is a client side SDK, it is intended for use in a single-user context, which can be mobile, desktop or embedded applications. This SDK can only be ran in a browser environment, it is not suitable for NodeJs applications, server side SDKs are available in our other repos.

This SDK has two main works:
- Makes feature flags available to the client side code
- Sends feature flags usage, click, pageview and custom events for the insights and A/B/n testing.

## Data synchonization
We use websocket to make the local data synchronized with the server, and then persist in localStorage. Whenever there is any changes to a feature flag, the changes would be pushed to the SDK, the average synchronization time is less than **100** ms. Be aware the websocket connection can be interrupted by any error or internet interruption, but it would be restored automatically right after the problem is gone.

## Offline mode support
As all data is stored locally in the localStorage, in the following situations, the SDK would still work when there is temporarily no internet connection:
- it has already received the data from previous connections
- the Ffc.bootstrap(featureFlags) method is called with all necessary feature flags

In the meantime, the SDK would try to reconnect to the server by an incremental interval, this makes sure that the websocket would be restored when the internet connection is back.

## Evaluation of a feature flag
After initialization, the SDK has all the feature flags locally and it does not need to request the remote server for any feature flag evaluation. All evaluation is done locally and synchronously, the average evaluation time is about **1** ms.

## Getting started
### Install
npm
  ```
  npm install featbit-js-client-sdk
  ```

yarn
```
yarn add featbit-js-client-sdk
```

To import the SDK:
```javascript
// Using ES2015 imports
import fbClient from 'featbit-js-client-sdk';

// Using TypeScript imports
import fbClient from 'featbit-js-client-sdk';

// Using react imports
import fbClient from 'featbit-js-client-sdk';
```

If using typescript and seeing the following error:
```
Cannot find module 'featbit-js-client-sdk/esm'. Did you mean to set the 'moduleResolution' option to 'node', or to add aliases to the 'paths' option?
```
just add this in your tsconfig.json file
```json
  "compilerOptions": {
    "moduleResolution": "node"
  },
```

### Initializing the SDK
Before initializing the SDK, you need to get the client-side env secret of your environment from our SaaS platform.

```javascript
const option = {
  secret: 'your env secret',
  user: {
    name: 'the user's user name',
    keyId: 'the user's unique identifier'
  }
};

fbClient.init(option);
```

The complete list of the available parameters in option:
- **secret**: the client side secret of your environment. **mandatory** (NB. this becomes optional if enableDataSync equals false)
- **anonymous**: true if you want to use a anonymous user, which is the case before user login to your APP. If that is your case, the user can be set later with the **identify** method after the user has logged in. The default value is false. **not mandatory**
- **bootstrap**: init the SDK with feature flags, this will trigger the ready event immediately instead of requesting from the remote. **not mandatory**
- **enableDataSync**: false if you do not want to sync data with remote server, in this case feature flags must be set to **bootstrap** option or be passed to the method **bootstrap**. The default value is true. **not mandatory** 
- **devModePassword**: if set, the developer mode is enabled, and it must be activated by calling the method **activateDevMode** with password on Ffc . **not mandatory** 
- **api**: the remote server URL. **mandatory**
- **appType**: the app type, the default value is javascript, **not mandatory**
- **user**: the user connected to your APP, can be ignored if **anonymous** equals to true. 
  - **name**: the user-friendly name, useful when viewing users in the portal. **mandatory**
  - **keyId**: the unique user identifier. **mandatory**
  - **customizedProperties**: any customized properties you want to send to the back end. It is extremely powerful when you define targeting rules or segments. **not mandatory**
     - it must have the following format:
     ```json
      [{
        "name": "the name of the property",
        "value": "the value of the property"
      }]
     ```

#### Initialization delay
Initializing the client makes a remote request to the server, so it may take 100 milliseconds or more before the SDK emits the ready event. If you require feature flag values before rendering the page, we recommend bootstrapping the client. If you bootstrap the client, it will emit the ready event immediately.

### Get the varation value of a feature flag
Two methods to get the variation of a feature flag

```javascript
// Use this method for all cases
// This method supports type inspection, it returns the value with the type defined on remote,
// so defaultValue should have the same type as defined on remote
var flagValue = fbClient.variation("YOUR_FEATURE_KEY", defaultValue);
```

### Developer mode
Developer mode is a powerful tool we created allowing developers to manipulate the feature flags locally instead of modifying them on remote server. **This will not change the remote values**.

To activate the developer mode, the activateDevMode method should be called as following, the password parameter is

```javascript
// This will activate developer mode, you should be able to see an icon on bottom right of the screen. 
// PASSWORD is mandatory and it should be the same as the value passed to option
fbClient.activateFeatbitDevMode('PASSWORD');

// or
// this method is equivalent to Ffc.activateDevMode('PASSWORD')
window.activateFeatbitDevMode('PASSWORD'); 
```

To open the developer mode editor or quit developer mode, use the following code:

```javascript
// The method will open the developer mode editor, or you can just click on the developer mode icon
fbClient.openDevModeEditor();

// call this method to quit developer mode
fbClient.quitDevMode();

// or
// this is equivalent to Ffc.quitDevMode()
window.quitFeatbitDevMode();
```

### bootstrap
If you already have the feature flags available, two ways to pass them to the SDK instead of requesting from the remote.
- By the **init** method

```javascript
  // define the option with the bootstrap parameter
const option = {
  ...
          // the array should contain all your feature flags
          bootstrap = [{
            // feature flag key name
            id: string,
            // variation value
            variation: string,
            // variation data type, string will used if not specified
            variationType: string
          }],
  ...
}

fbClient.init(option);
```

- By the **bootstrap** method

```javascript
// this array should contain all your feature flags
const featureflags = [{
  // feature flag key name
  id: string,
  // variation value
  variation: string,
  // variation data type, string will used if not specified
  variationType: string
}]

fbClient.bootstrap(featureflags);
```

**If you want to disable the synchronization with remote server, set enableDataSync to false in option**. In this case, bootstrap option must be set or bootstrap method must be called with feature flags.

To find out when the client is ready, you can use one of two mechanisms: events or promises.

The client object can emit JavaScript events. It emits a ready event when it receives initial flag values from feature-flags.co. You can listen for this event to determine when the client is ready to evaluate flags.

```javascript
fbClient.on('ready', (data) => {
  // data has the following structure [ {id: 'featureFlagKey', variation: variationValue} ]
  // variationValue has the type as defined on remote
  var flagValue = fbClient.variation("YOUR_FEATURE_KEY", defaultValue);
});

```

Or, you can use a promise instead of an event. The SDK has a method that return a promise for initialization: waitUntilReady(). The behavior of waitUntilReady() is equivalent to the ready event. The promise resolves when the client receives its initial flag data. As with all promises, you can either use .then() to provide a callback, or use await if you are writing asynchronous code.

```javascript
fbClient.waitUntilReady().then((data) => {
  // data has the following structure [ {id: 'featureFlagKey', variation: variationValue } ]
  // variationValue has the type as defined on remote
  // initialization succeeded, flag values are now available
});
// or, with await:
const featureFlags = await fbClient.waitUntilReady();
// initialization succeeded, flag values are now available
```

The SDK only decides initialization has failed if it receives an error response indicating that the environment ID is invalid. If it has trouble connecting to feature-flags.co, it will keep retrying until it succeeds.

### Set the user after initialization
If the user parameter cannot be passed by the init method, the following method can be used to set the user after initialization.

```javascript
  fbClient.identify(user);
```

### Set the user to anonymous user
We can manully call the method logout, which will switch the current user back to anonymous user if exists already or create a new anonymous user.

```javascript
  fbClient.logout(user);
```

### Subscribe to the changes of feature flag(s)
To get notified when a feature flag is changed, we offer two methods
- subscribe to the changes of any feature flag(s)

```javascript
fbClient.on('ff_update', (changes) => {
  // changes has this structure [{id: 'the feature_flag_key', oldValue: theOldValue, newValue: theNewValue }]
  // theOldValue and theNewValue have the type as defined on remote
...
});

```
- subscribe to the changes of a specific feature flag

```javascript
// replace feature_flag_key with your feature flag key
fbClient.on('ff_update:feature_flag_key', (change) => {
  // change has this structure {id: 'the feature_flag_key', oldValue: theOldValue, newValue: theNewValue }
  // theOldValue and theNewValue have the type as defined on remote

  // defaultValue should have the type as defined on remote
  const myFeature = fbClient.variation('feature_flag_key', defaultValue);
...
});

```

## Experiments (A/B/n Testing)
We support automatic experiments for pageviews and clicks, you just need to set your experiment on our SaaS platform, then you should be able to see the result in near real time after the experiment is started.

In case you need more control over the experiment data sent to our server, we offer a method to send custom event.

```javascript
fbClient.sendCustomEvent([{
  eventName: 'your event name',
  numericValue: 1
}])
```
**numericValue** is not mandatory, the default value is **1**.

Make sure sendCustomEvent is called after the related feature flag is called by simply calling **Ffc.variation('featureFlagKeyName', 'default value')**, otherwise, the custom event won't be included into the experiment result.


