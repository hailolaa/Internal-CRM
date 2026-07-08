import pool from "../../config/database.js";
import { sequencesService } from "../sequences/sequences.service.js";
import { slaService } from "../sla/sla.service.js";
import { tasksService } from "../tasks/tasks.service.js";
import type { BackgroundJobTaskResult } from "./background-jobs.types.js";

async function listActiveClinicIds() {
  const [rows]: any = await pool.execute(
    "SELECT id FROM clinic WHERE deleted_at IS NULL ORDER BY id",
  );

  return rows.map((row: any) => row.id as string);
}

// Job shells enumerate clinics now so later SLA logic stays tenant-scoped.
export async function runSlaBreachCheck(): Promise<BackgroundJobTaskResult> {
  const result = await slaService.detectSlaBreaches();

  return {
    clinicsChecked: result.clinicsChecked,
    contactsChecked: result.contactsChecked,
    breachesCreated: result.breachesCreated,
  };
}

export async function runDailySlaReport(): Promise<BackgroundJobTaskResult> {
  const clinicIds = await listActiveClinicIds();
  let appointmentsChecked = 0;
  let noShows = 0;
  let soldConsults = 0;
  let consultRevenue = 0;

  for (const clinicId of clinicIds) {
    const [appointmentRows]: any = await pool.execute(
      `SELECT COUNT(*) as appointmentsChecked,
              SUM(CASE WHEN status = 'NoShow' THEN 1 ELSE 0 END) as noShows
       FROM appointment
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND DATE(date_time) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
      [clinicId],
    );
    const [consultRows]: any = await pool.execute(
      `SELECT COUNT(*) as soldConsults,
              COALESCE(SUM(revenue), 0) as consultRevenue
       FROM manual_consult_entry
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND outcome IN ('sold', 'treatment_booked', 'Treatment Booked')
         AND consult_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
      [clinicId],
    );

    appointmentsChecked += Number(appointmentRows[0]?.appointmentsChecked || 0);
    noShows += Number(appointmentRows[0]?.noShows || 0);
    soldConsults += Number(consultRows[0]?.soldConsults || 0);
    consultRevenue += Number(consultRows[0]?.consultRevenue || 0);
  }

  return {
    clinicsChecked: clinicIds.length,
    appointmentsChecked,
    noShows,
    soldConsults,
    consultRevenue,
  };
}

export async function runRecurringTasksGeneration(): Promise<BackgroundJobTaskResult> {
  const generatedCount = await tasksService.processAllRecurringTasks();
  return {
    generatedCount,
  };
}

export async function runSequenceExecution(): Promise<BackgroundJobTaskResult> {
  return sequencesService.processDueSequences({ limit: 100 });
}

