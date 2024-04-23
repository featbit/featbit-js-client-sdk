import { JsonBootstrapProvider } from "../../src/bootstrap/JsonBootstrapProvider";
import testData from "./featbit-bootstrap.json";
import DataSourceUpdates from "../../src/data-sources/DataSourceUpdates";
import InMemoryStore from "../../src/store/InMemoryStore";
import DataKinds from "../../src/store/DataKinds";
import { IStore } from "../../src/platform/IStore";
import { IFlagBase, UserBuilder } from "../../src";

describe('given a JsonBootstrapProvider', () => {
  it('use valid json', () => {
    const provider = new JsonBootstrapProvider(testData as unknown as IFlagBase[]);

    expect(provider).not.toBeNull();
  });

  it('populate store', async () => {
    const provider = new JsonBootstrapProvider(testData as unknown as IFlagBase[]);
    const user = new UserBuilder('anonymous').build();
    const store: IStore = new InMemoryStore({});
    store.identify(user);

    const dataSourceUpdates = new DataSourceUpdates(store, () => false, () => {})

    await provider.populate(user.keyId, dataSourceUpdates);

    const flag1 = store.get(DataKinds.Flags, 'flag1');
    const flag = store.get(DataKinds.Flags, 'example-flag');

    expect(flag1).not.toBeNull();
    expect(flag).toBeNull();
  });
});