import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCandidateDocumentsAndSummaries1773239417416 implements MigrationInterface {
    name = 'AddCandidateDocumentsAndSummaries1773239417416'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sample_candidates" DROP CONSTRAINT "fk_sample_candidates_workspace_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sample_candidates_workspace_id"`);
        await queryRunner.query(`CREATE TABLE "candidate_documents" ("id" character varying(64) NOT NULL, "candidate_id" character varying(64) NOT NULL, "document_type" character varying(32) NOT NULL, "file_name" character varying(255) NOT NULL, "storage_key" character varying(255) NOT NULL, "raw_text" text NOT NULL, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a7b7572a2c5c1320a4249ce2b4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "candidate_summaries" ("id" character varying(64) NOT NULL, "candidate_id" character varying(64) NOT NULL, "status" character varying(32) NOT NULL, "score" integer, "strengths" jsonb, "concerns" jsonb, "summary" text, "recommended_decision" character varying(32), "provider" character varying(64), "prompt_version" character varying(64), "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_71af82300df454f7e82c777952e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "sample_candidates" ADD CONSTRAINT "FK_8acbadc1075b949c0d0b5d2ea47" FOREIGN KEY ("workspace_id") REFERENCES "sample_workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "candidate_documents" ADD CONSTRAINT "FK_2d1a14e9cb167a840b369a6cb71" FOREIGN KEY ("candidate_id") REFERENCES "sample_candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "candidate_summaries" ADD CONSTRAINT "FK_b033f7e869dac60987c01f8df7a" FOREIGN KEY ("candidate_id") REFERENCES "sample_candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate_summaries" DROP CONSTRAINT "FK_b033f7e869dac60987c01f8df7a"`);
        await queryRunner.query(`ALTER TABLE "candidate_documents" DROP CONSTRAINT "FK_2d1a14e9cb167a840b369a6cb71"`);
        await queryRunner.query(`ALTER TABLE "sample_candidates" DROP CONSTRAINT "FK_8acbadc1075b949c0d0b5d2ea47"`);
        await queryRunner.query(`DROP TABLE "candidate_summaries"`);
        await queryRunner.query(`DROP TABLE "candidate_documents"`);
        await queryRunner.query(`CREATE INDEX "idx_sample_candidates_workspace_id" ON "sample_candidates" ("workspace_id") `);
        await queryRunner.query(`ALTER TABLE "sample_candidates" ADD CONSTRAINT "fk_sample_candidates_workspace_id" FOREIGN KEY ("workspace_id") REFERENCES "sample_workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
