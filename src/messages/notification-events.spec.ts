import { NotificationEventsSubscriber } from "./notification-events.subscriber";

describe("live notification pushes", () => {
  function setup() {
    const dataSource = { subscribers: [] as unknown[] };
    const gateway = { publishNotification: jest.fn() };
    const subscriber = new NotificationEventsSubscriber(dataSource as never, gateway as never);
    return { dataSource, gateway, subscriber };
  }
  const notification = (id: string) => ({ id, userId: "bola", type: "match_invite", title: "New match invite", body: "", data: {} });

  it("registers itself with the data source", () => {
    const { dataSource, subscriber } = setup();
    expect(dataSource.subscribers).toContain(subscriber);
  });

  it("pushes only after the outer transaction commits, not when a savepoint is released", () => {
    const { gateway, subscriber } = setup();
    const queryRunner = { isTransactionActive: true };
    subscriber.afterInsert({ queryRunner, entity: notification("n1") } as never);
    subscriber.afterTransactionCommit({ queryRunner } as never); // savepoint released, still inside the transaction
    expect(gateway.publishNotification).not.toHaveBeenCalled();
    queryRunner.isTransactionActive = false;
    subscriber.afterTransactionCommit({ queryRunner } as never);
    expect(gateway.publishNotification).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
  });

  it("never pushes a notification whose transaction rolled back", () => {
    const { gateway, subscriber } = setup();
    const queryRunner = { isTransactionActive: true };
    subscriber.afterInsert({ queryRunner, entity: notification("n2") } as never);
    queryRunner.isTransactionActive = false;
    subscriber.afterTransactionRollback({ queryRunner } as never);
    subscriber.afterTransactionCommit({ queryRunner } as never);
    expect(gateway.publishNotification).not.toHaveBeenCalled();
  });

  it("pushes straight away outside a transaction", () => {
    const { gateway, subscriber } = setup();
    subscriber.afterInsert({ queryRunner: { isTransactionActive: false }, entity: notification("n3") } as never);
    expect(gateway.publishNotification).toHaveBeenCalledTimes(1);
  });
});
