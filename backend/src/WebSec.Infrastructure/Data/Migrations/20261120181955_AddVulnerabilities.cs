using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebSec.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVulnerabilities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "vulnerability_id",
                table: "scan_findings",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "vulnerabilities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_id = table.Column<Guid>(type: "uuid", nullable: false),
                    fingerprint = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    finding_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    parameter_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    severity = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    is_reappeared = table.Column<bool>(type: "boolean", nullable: false),
                    assignee_id = table.Column<Guid>(type: "uuid", nullable: true),
                    close_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    review_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    first_detected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_detected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vulnerabilities", x => x.id);
                    table.ForeignKey(
                        name: "fk_vulnerabilities_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_vulnerabilities_targets_target_id",
                        column: x => x.target_id,
                        principalTable: "targets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_vulnerabilities_users_assignee_id",
                        column: x => x.assignee_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "vulnerability_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    vulnerability_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    is_ai_note = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vulnerability_comments", x => x.id);
                    table.ForeignKey(
                        name: "fk_vulnerability_comments_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_vulnerability_comments_vulnerabilities_vulnerability_id",
                        column: x => x.vulnerability_id,
                        principalTable: "vulnerabilities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vulnerability_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    vulnerability_id = table.Column<Guid>(type: "uuid", nullable: false),
                    changed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    old_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    new_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vulnerability_histories", x => x.id);
                    table.ForeignKey(
                        name: "fk_vulnerability_histories_users_changed_by",
                        column: x => x.changed_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_vulnerability_histories_vulnerabilities_vulnerability_id",
                        column: x => x.vulnerability_id,
                        principalTable: "vulnerabilities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_scan_findings_vulnerability_id",
                table: "scan_findings",
                column: "vulnerability_id");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerabilities_assignee_id",
                table: "vulnerabilities",
                column: "assignee_id");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerabilities_project_id",
                table: "vulnerabilities",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerabilities_severity",
                table: "vulnerabilities",
                column: "severity");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerabilities_status",
                table: "vulnerabilities",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerabilities_target_id_fingerprint",
                table: "vulnerabilities",
                columns: new[] { "target_id", "fingerprint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_vulnerability_comments_user_id",
                table: "vulnerability_comments",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerability_comments_vulnerability_id",
                table: "vulnerability_comments",
                column: "vulnerability_id");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerability_histories_changed_by",
                table: "vulnerability_histories",
                column: "changed_by");

            migrationBuilder.CreateIndex(
                name: "ix_vulnerability_histories_vulnerability_id",
                table: "vulnerability_histories",
                column: "vulnerability_id");

            migrationBuilder.AddForeignKey(
                name: "fk_scan_findings_vulnerabilities_vulnerability_id",
                table: "scan_findings",
                column: "vulnerability_id",
                principalTable: "vulnerabilities",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_scan_findings_vulnerabilities_vulnerability_id",
                table: "scan_findings");

            migrationBuilder.DropTable(
                name: "vulnerability_comments");

            migrationBuilder.DropTable(
                name: "vulnerability_histories");

            migrationBuilder.DropTable(
                name: "vulnerabilities");

            migrationBuilder.DropIndex(
                name: "ix_scan_findings_vulnerability_id",
                table: "scan_findings");

            migrationBuilder.DropColumn(
                name: "vulnerability_id",
                table: "scan_findings");
        }
    }
}
