import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntitySubscriberInterface, InsertEvent, QueryRunner, TransactionCommitEvent, TransactionRollbackEvent } from "typeorm";
import { Notification } from "../database/entities";
import { MessagesGateway } from "./messages.gateway";

/**
 * Pushes every new in-app notification to its recipient over the chat socket ("notification:new"),
 * so members see a pop-up on any page instead of only on the Notifications screen.
 * Inserts inside a transaction are held until it commits, so a rolled-back notification never pops up.
 */
@Injectable()
export class NotificationEventsSubscriber implements EntitySubscriberInterface<Notification> {
  private readonly pending = new WeakMap<QueryRunner, Notification[]>();

  constructor(@InjectDataSource() dataSource: DataSource, private readonly gateway: MessagesGateway) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Notification;
  }

  afterInsert(event: InsertEvent<Notification>) {
    const runner = event.queryRunner;
    if (runner?.isTransactionActive) this.pending.set(runner, [...(this.pending.get(runner) ?? []), event.entity]);
    else this.gateway.publishNotification(event.entity);
  }

  afterTransactionCommit(event: TransactionCommitEvent) {
    if (event.queryRunner.isTransactionActive) return; // a savepoint was released; the outer transaction is still open
    const queued = this.pending.get(event.queryRunner);
    this.pending.delete(event.queryRunner);
    queued?.forEach((notification) => this.gateway.publishNotification(notification));
  }

  afterTransactionRollback(event: TransactionRollbackEvent) {
    if (event.queryRunner.isTransactionActive) return; // only a savepoint rolled back
    this.pending.delete(event.queryRunner);
  }
}
