# FeatBit Client-Side SDK for JavaScript

## Introduction

This is the client side SDK for the feature management platform [FeatBit](https://github.com/featbit/featbit). 

Be aware, this is a client side SDK, it is intended for use in a single-user context, which can be mobile, desktop or embedded applications. This SDK can only be ran in a browser environment, it is not suitable for NodeJs applications.

## Get Started

### Installation

```bash
npm install featbit-js-client-sdk
```

### Prerequisite

Before using the SDK, you need to obtain the environment secret and SDK URLs. 

Follow the documentation below to retrieve these values

- [How to get the environment secret](https://docs.featbit.co/docs/sdk/faq#how-to-get-the-environment-secret)
- [How to get the SDK URLs](https://docs.featbit.co/docs/sdk/faq#how-to-get-the-sdk-urls)

### Quick Start

The following code demonstrates:
1. Initialize the SDK
2. Evaluate flag
3. Subscribe to flag change

```javascript
import fbClient from 'featbit-js-client-sdk';

const option = {
  secret: "your env secret",
  api:"http://localhost:5100", // the Streaming URL
  user: {
    name: "Bot",
    keyId: "bot-id",
    customizedProperties: [
      {
        "name": "level",
        "value": "high"
      }
    ]
  }
};

// initialization
fbClient.init(option);

// evaluation
const flagValue = fbClient.variation("YOUR_FEATURE_KEY", defaultValue);

// subscribe to flag change
fbClient.on('ff_update:YOUR_FEATURE_KEY', (change) => {
  // change has this structure {id: 'the feature_flag_key', oldValue: theOldValue, newValue: theNewValue }
  // the type of theOldValue and theNewValue is defined on FeatBit

  // defaultValue should have the same type as theOldValue and theNewValue
  const myFeature = fbClient.variation('YOUR_FEATURE_KEY', defaultValue);
});
```

## Examples

- [Vue](https://github.com/featbit/featbit-samples/tree/main/samples/dino-game/interactive-demo-vue)
- [React](https://github.com/featbit/featbit-samples/tree/main/samples/dino-game/interactive-demo-react)

## SDK

### Initialization

Before initializing the SDK, you need to get the client-side env secret of your environment from FeatBit.

```javascript
const option = {
  secret: "your env secret",
  api:"http://localhost:5100", // the Streaming URL
  user: {
    name: "Bot",
    keyId: "bot-id",
    customizedProperties: [
      {
          "name": "level",
          "value": "high"
      }
    ]
  }
};

fbClient.init(option);
```

The user has three properties:
- name(**requried**):  The user's name, useful when viewing users in the portal.
- keyId(**requried**): The unique user identifier.
- api: The streaming URL.
- customizedProperties(**optional**): Any other customized properties. Users can be targeted by these customized properties. Here is the format definition:
```json
 [
   {
     "name": "the name of the property",
     "value": "the value of the property"
   }
]
```

This table lists all available options

| Options               | Defaults                | Description                                                                                                                                                                                              |
|-----------------------|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| secret (**required**) | -                       | The client side secret of your environment.                                                                                                                                                              |
| user   (**required**) | -                       | The user connected to your APP, can be ignored if anonymous equals to true.                                                                                                                              |
| anonymous             | `false`                 | Set to true if you want to use a anonymous user, which is the case before user login to your APP. If that is your case, the user can be set later with the identify method after the user has logged in. |
| enableDataSync        | `true`                  | Set to false if you do not want to sync data with remote server, in this case feature flags must be set to bootstrap option or be passed to the method bootstrap.                                        |
| bootstrap             | `[ ]`                   | Init the SDK with feature flags, this will trigger the ready event immediately instead of requesting from the remote.                                                                                    |
| api                   | `http://localhost:5100` | The evaluation server streaming URL.                                                                                                                                                                     |
| appType               | `javascript`            | The app type.                                                                                                                                                                                            |
| devModePassword       | `''`                    | If set, the developer mode is enabled. To activate it, you need to call the method activateDevMode with password.                                                                                        |

### Bootstrap
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

### Evaluation

After initialization, the SDK has all the feature flags locally, and it does not need to request the remote server for any feature flag evaluation. All evaluation is done locally and synchronously, the average evaluation time is about **1** ms.

```javascript
// Use this method for all cases
// This method supports type inspection, it returns the value with the type defined on FeatBit,
// so defaultValue should have the same type as defined on FeatBit
const flagValue = fbClient.variation("YOUR_FEATURE_KEY", defaultValue);
```

### Events

#### Wait for ready

To find out when the client is ready, you can use one of two mechanisms: events or promises.

The client object can emit JavaScript events. It emits a ready event when it receives initial flag values from the server. You can listen for this event to determine when the client is ready to evaluate flags.

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

#### Subscribe to flag(s) changes

To get notified when a feature flag is changed, we offer two methods
- subscribe to the changes of any feature flag(s)

```javascript
fbClient.on('ff_update', (changes) => {
  // changes has this structure [{id: 'the feature_flag_key', oldValue: theOldValue, newValue: theNewValue }]
  // the type of theOldValue and theNewValue is defined on FeatBit
  
  // do something when any feature flag changes
});

```
- subscribe to the changes of a specific feature flag

```javascript
// replace feature_flag_key with your feature flag key
fbClient.on('ff_update:feature_flag_key', (change) => {
  // change has this structure {id: 'the feature_flag_key', oldValue: theOldValue, newValue: theNewValue }
  // the type of theOldValue and theNewValue is defined on FeatBit

  // defaultValue should have the same type as theOldValue and theNewValue
  // this is the prefered way than calling change.newValue as each time you call fbClient.variation,
  // the insight data is sent to server automatically
  const myFeature = fbClient.variation('feature_flag_key', defaultValue);
});

```

### Switch user after initialization
If the user parameter cannot be passed by the init method, the following method can be used to set the user after initialization.

```javascript
  fbClient.identify(user);
```

We can manually call the method logout, which will switch the current user back to anonymous user if exists already or create a new anonymous user.

```javascript
  fbClient.logout(user);
```

### Developer mode
Developer mode is a powerful tool we created allowing developers to manipulate the feature flags locally instead of modifying them on remote server. **This will not change the remote values**.

To activate the developer mode, the activateDevMode method should be called as following, the password parameter is

```javascript
// This will activate developer mode, you should be able to see an icon on bottom right of the screen. 
// PASSWORD is mandatory and it should be the same as the value passed to option
fbClient.activateFeatbitDevMode('PASSWORD');

// or
// this method is equivalent to fbClient.activateDevMode('PASSWORD')
window.activateFeatbitDevMode('PASSWORD'); 
```

To open the developer mode editor or quit developer mode, use the following code:

```javascript
// The method will open the developer mode editor, or you can just click on the developer mode icon
fbClient.openDevModeEditor();

// call this method to quit developer mode
fbClient.quitDevMode();

// or
// this is equivalent to fbClient.quitDevMode()
window.quitFeatbitDevMode();
```

### Data synchronization

We use websocket to make the local data synchronized with the server, and then store them in memory by default. Whenever there is any change to a feature flag or its related data, this change will be pushed to the SDK, the average synchronization time is less than 100ms. Be aware the websocket connection may be interrupted due to internet outage, but it will be resumed automatically once the problem is gone.

### Network failure handling

As all data is stored locally in the localStorage, in the following situations, the SDK would still work when there is temporarily no internet connection:
- it has already received the data from previous connections
- the fbClient.bootstrap(featureFlags) method is called with all necessary feature flags

In the meantime, the SDK would try to reconnect to the server by an incremental interval, this makes sure that the websocket would be restored when the internet connection is back.


### Experiments (A/B/n Testing)

We support automatic experiments for page views and clicks, you just need to set your experiment on FeatBit portal, then you should be able to see the result in near real time after the experiment is started.

In case you need more control over the experiment data sent to our server, we offer a method to send custom event.

```javascript
fbClient.sendCustomEvent([{
  eventName: 'your event name',
  numericValue: 1
}])
```

**numericValue** is not mandatory, the default value is **1**.

Make sure sendCustomEvent is called after the related feature flag is called by simply calling **fbClient.variation('featureFlagKeyName', 'default value')**, otherwise, the custom event won't be included into the experiment result.

## Getting support

- If you have a specific question about using this SDK, we encourage you to [ask it in Slack](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ).
- If you encounter a bug or would like to request a feature, [submit an issue](https://github.com/featbit/featbit-js-client-sdk/issues).

## See Also

- [FeatBit in 3 minutes](https://docs.featbit.co/docs/getting-started/1.-featbit-in-3-minutes)
