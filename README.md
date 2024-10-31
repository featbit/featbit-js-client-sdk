> **Attention**
>
> If you are using the v1 or v2 of the SDK, please refer to this [doc](https://github.com/featbit/featbit-js-client-sdk/tree/v2)

# FeatBit Client SDK for JavaScript

## Introduction

This is the Client-Side SDK for the 100% open-source feature flags management platform [FeatBit](https://github.com/featbit/featbit).

Be aware, this is a client side SDK, it is intended for use in a single-user context, which can be mobile, desktop or embedded applications. This SDK can only be ran in a browser environment, it is not suitable for NodeJs applications.

## Get Started

### Installation

```bash
npm install --save @featbit/js-client-sdk
```
### Prerequisite

Before using the SDK, you need to obtain the environment secret (the sdkKey) and SDK URLs.

Follow the documentation below to retrieve these values
- [How to get environment secret](https://docs.featbit.co/sdk/faq#how-to-get-the-environment-secret)
- [How to get SDK URLs](https://docs.featbit.co/sdk/faq#how-to-get-the-sdk-urls)

### Quick Start

The following code demonstrates the basic usage of `@featbit/js-client-sdk`.

```javascript
import { FbClientBuilder, UserBuilder } from "@featbit/js-client-sdk";

const bob = new UserBuilder('a-unique-key-of-user')
    .name('bob')
    .custom('age', '18')
    .custom('country', 'FR')
    .build();

// setup SDK client with websocket streaming
const fbClient = new FbClientBuilder()
    .sdkKey("your_sdk_key")
    .streamingUri('ws://localhost:5100')
    .eventsUri("http://localhost:5100")
    .user(bob)
    .build();

(async () => {
  // wait for the SDK to be initialized
  try {
    await fbClient.waitForInitialization();
  } catch(err) {
    // failed to initialize the SDK
    console.log(err);
  }

  // flag to be evaluated
  const flagKey = "game-runner";

  // evaluate a feature flag for a given user
  const boolVariation = await fbClient.boolVariation(flagKey, false);

  // switch user
  const alice = new UserBuilder('another-unique-key-of-user')
      .name('alice')
      .custom('country', 'UK')
      .custom('age', 36)
      .build();
  
  await fbClient.identify(alice);
})();
```

## Examples
- [web App](./examples/console-app)
- For how to use FeatBit with React, please refer to the [react-client-sdk](https://github.com/featbit/featbit-react-client-sdk)

## SDK

### FbClient

The `FbClient` is the heart of the SDK which provides access to FeatBit server. Applications should instantiate a single instance for the lifetime of the application.

`FbClientBuilder` is used to construct a `FbClient` instance. The builder exposes methods to configure the SDK, and finally to create the `FbClient` instance.

#### FbClient Using Streaming

```javascript
import { FbClientBuilder, UserBuilder } from "@featbit/js-client-sdk";

const user = new UserBuilder('a-unique-key-of-user')
    .name('bob')
    .build();
    
const fbClient = new FbClientBuilder()
    .sdkKey("your_sdk_key")
    .streamingUri('ws://localhost:5100')
    .eventsUri("http://localhost:5100")
    .user(user)
    .build();
```
#### FbClient Using Polling

```javascript
import { FbClientBuilder, UserBuilder, DataSyncModeEnum } from "@featbit/js-client-sdk";

const user = new UserBuilder('a-unique-key-of-user')
    .name('bob')
    .build();

const fbClient = new FbClientBuilder()
    .sdkKey("your_sdk_key")
    .dataSyncMode(DataSyncModeEnum.POLLING)
    .pollingUri('http://localhost:5100')
    .eventsUri("http://localhost:5100")
    .pollingInterval(10000)
    .build();
```

#### IUser

`IUser` defines the attributes of a user for whom you are evaluating feature flags. IUser has two built-in attributes: key and name. The only mandatory attribute of a IUser is the key, which must uniquely identify each user.

Besides these built-in properties, you can define any additional attributes associated with the user using `custom(string key, string value)` method on UserBuilder. Both built-in attributes and custom attributes can be referenced in targeting rules, and are included in analytics data.

`UserBuilder` is used to construct a `IUser` instance. The builder exposes methods to configure the IUser, and finally to create the IUser instance.

```javascript
import { UserBuilder } from "@featbit/js-client-sdk";

const bob = new UserBuilder("unique_key_for_bob")
    .name("Bob")
    .custom('age', 18)
    .custom('country', 'FR')
    .build();
```

### Bootstrap
If you already have the feature flags available, you can pass them to the SDK instead of requesting from the remote.


> **_NOTE:_** The bootstrapped flags will be overridden by the remote flags if they are available.

```javascript
// define the option with the bootstrap parameter
const options = {
  ...
  bootstrap = [{
    // feature flag key name
    id: string,
    // variation value
    variation: string,
    // variation data type, string will be used if not specified
    variationType: VariationDataType
  }]
}

const fbClient = new FbClientBuilder(options).build();
// or
const fbClient = new FbClientBuilder()
    //... other options
    .bootstrap(options.bootstrap)
    .build();
```

### Evaluation

After initialization, the SDK has all the feature flags locally, and it does not need to request the remote server for any feature flag evaluation. All evaluation is done locally and synchronously, the average evaluation time is less than 1 ms.

There is a `variation` method that returns a flag value, and a `variationDetail` method that returns an object
describing how the value was determined for each type.

- boolVariation/boolVariationDetail
- stringVariation/stringVariationDetail
- numberVariation/numberVariationDetail
- jsonVariation/jsonVariationDetail

Variation calls take the feature flag key and a default value. If any error makes it impossible to
evaluate the flag (for instance, the feature flag key does not match any existing flag), default value is returned.

```javascript
// flag to be evaluated
const flagKey = "game-runner";

// evaluate a feature flag for a given user
const boolVariation = await fbClient.boolVariation(flagKey, false);

// evaluate a boolean flag for a given user with evaluation detail
const boolVariationDetail = await fbClient.boolVariationDetail(flagKey, false);
```

### Offline Mode

In some situations, you might want to stop making remote calls to FeatBit. Here is how:
```javascript
import { FbClientBuilder } from "@featbit/browser-server-sdk";

const fbClient = new FbClientBuilder()
    //... other options
    .offline(true)
    .build();

```
When Offline mode is enabled, you should provide the flags with the [bootstrap](#bootstrap) option,
otherwise, the SDK would return the defaul value you passed to the `variation` method.

### Events

#### Wait for ready

To find out when the client is ready, you can use one of two mechanisms: events or promises.

The client object can emit JavaScript events. It emits a ready event when it receives initial flag values from the server. You can listen for this event to determine when the client is ready to evaluate flags.

```javascript
fbClient.on('ready', () => {
  var flagValue = fbClient.variation("YOUR_FEATURE_KEY", defaultValue);
});
```

Or, you can use a promise instead of an event. The SDK has a method that returns a promise for initialization: **waitForInitialization()**. The behavior of waitUntilReady() is equivalent to the ready event. The promise resolves when the client receives its initial flag data. As with all promises, you can either use .then() to provide a callback, or use await if you are writing asynchronous code.

```javascript
fbClient.waitForInitialization().then((data) => {
  // data has the following structure [ {id: 'featureFlagKey', variation: variationValue } ]
  // variationValue has the type as defined on remote
  // initialization succeeded, flag values are now available
});
// or, with await:
const featureFlags = await fbClient.waitForInitialization();
// initialization succeeded, flag values are now available
```

The SDK only decides initialization has failed if it receives an error response indicating that the environment ID is invalid. If it has trouble connecting to FeatBit, it will keep retrying until it succeeds.

#### Subscribe to flag(s) changes

To get notified when a feature flag is changed, we offer two methods
- subscribe to the changes of any feature flag(s)

```javascript
fbClient.on('update', (keys: string[]) => {
  // do something when any feature flag changes
});

```
- subscribe to the changes of a specific feature flag

```javascript
// replace feature_flag_key with your feature flag key
fbClient.on('update:feature_flag_key', (key) => {
  const myFeature = fbClient.variation('feature_flag_key', defaultValue);
});

```

### Switch user after initialization
If the user changed after some process, login for example, the following method can be used to set the user after initialization.

```javascript
await fbClient.identify(user);
```


### Data synchronization

We use **WebSocket** or **Polling** to make the local data synchronized with the server, and then store them in localStorage by default. Whenever there is any change to a feature flag or its related data, this change will be pushed to the SDK, the average synchronization time is less than **100ms** if WebSocket is configured. Be aware the WebSocket/Polling connection may be interrupted due to internet outage, but it will be resumed automatically once the problem is gone.

### Network failure handling

As all data is stored locally in the localStorage, in the following situations, the SDK would still work when there is temporarily no internet connection:
- it has already received the data from previous connections
- the `fbClient.bootstrap(featureFlags)` method is called with all necessary feature flags

In the meantime, the SDK would try to reconnect to the server by an incremental interval, this makes sure that the websocket would be restored when the internet connection is back.

### Experiments (A/B/n Testing)

We support automatic experiments for pageviews and clicks, you just need to set your experiment on our SaaS platform,
then you should be able to see the result in near real time after the experiment is started.

In case you need more control over the experiment data sent to our server, we offer a method to send custom event.

```javascript
fbClient.track(eventName, numericValue);
```

**numericValue** is not mandatory, the default value is **1.0**.

Make sure `track` is called after the related feature flag is called, otherwise the custom event won't be included
into the experiment result.

## Getting support
- If you have a specific question about using this sdk, we encourage you
  to [ask it in our slack](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ).
- If you encounter a bug or would like to request a
  feature, [submit an issue](https://github.com/featbit/dotnet-server-sdk/issues/new).

## See Also
- [Connect To JavaScript Sdk](https://docs.featbit.co/getting-started/connect-an-sdk#javascript)
