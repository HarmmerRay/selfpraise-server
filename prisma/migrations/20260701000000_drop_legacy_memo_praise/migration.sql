-- DropForeignKey
ALTER TABLE "memos" DROP CONSTRAINT "memos_user_id_fkey";
ALTER TABLE "praises" DROP CONSTRAINT "praises_user_id_fkey";

-- DropTable
DROP TABLE "memos";
DROP TABLE "praises";
