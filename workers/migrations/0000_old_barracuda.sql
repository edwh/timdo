CREATE TABLE `Projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'do' NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`size` text DEFAULT '***' NOT NULL,
	`notes` text,
	`status_last_changed_on` text,
	`is_deleted` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_email_unique` ON `Users` (`email`);