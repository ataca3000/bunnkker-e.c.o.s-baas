import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, Network, UserCheck, Users } from 'lucide-react';

import { PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAvailabilityQuery,
  useDepartmentAvailabilityQuery,
  useHolidaysQuery,
  useLeaveRequestsQuery,
} from '@/features/hr/hooks/use-hr';
import { ROUTES } from '@/router/routes';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Workforce Availability Dashboard — the operational answer to "who can work
 * today", with the department breakdown underneath it.
 */
export function WorkforceDashboardPage() {
  const [date, setDate] = useState(today());

  const { data: availability, isLoading } = useAvailabilityQuery({ date });
  const { data: departments } = useDepartmentAvailabilityQuery({ date });
  const { data: pendingLeave } = useLeaveRequestsQuery({ status: 'pending' });
  const { data: holidays } = useHolidaysQuery();

  const rows = departments?.departments ?? [];
  const upcomingHolidays = (holidays ?? [])
    .filter((h) => h.end_date >= today())
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Workforce"
        subtitle="Who is available today, across the company and by department."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            />
            <Button asChild size="sm">
              <Link to={ROUTES.hrAttendance}>
                <ClipboardList className="size-4" />
                Register Attendance
              </Link>
            </Button>
          </div>
        }
      />

      {/* Availability KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Headcount</div>
            <div className="text-2xl font-bold">{isLoading ? '—' : (availability?.headcount ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Present</div>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoading ? '—' : (availability?.present ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Absent</div>
            <div className="text-2xl font-bold text-red-600">{isLoading ? '—' : (availability?.absent ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">On Leave</div>
            <div className="text-2xl font-bold text-amber-600">
              {isLoading ? '—' : (availability?.on_leave ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {/* Never assumed present — an unregistered day is reported as unknown. */}
            <div className="text-muted-foreground text-sm">Not Registered</div>
            <div className="text-2xl font-bold text-slate-400">
              {isLoading ? '—' : (availability?.unregistered ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {availability?.official_holiday ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CalendarDays className="size-5 text-purple-600" />
            <div>
              <div className="font-medium">{availability.official_holiday.name}</div>
              <div className="text-muted-foreground text-sm">
                The company is closed on this date — attendance defaults to holiday.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Department attendance dashboard */}
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Department Attendance</h2>
              <span className="text-muted-foreground text-sm">{availability?.date ?? date}</span>
            </div>

            {rows.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No departments have employees yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Department</th>
                      <th className="py-2 pr-4 text-right font-medium">Headcount</th>
                      <th className="py-2 pr-4 text-right font-medium">Present</th>
                      <th className="py-2 pr-4 text-right font-medium">Absent</th>
                      <th className="py-2 pr-4 text-right font-medium">Leave</th>
                      <th className="py-2 pr-4 text-right font-medium">Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.department_id ?? 'unassigned'} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{row.department}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.headcount}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{row.present}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-red-600">{row.absent}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-amber-600">{row.on_leave}</td>
                        <td className="py-2 pr-4 text-right tabular-nums font-medium">
                          {row.availability_percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="font-semibold">Awaiting Approval</h2>
              {(pendingLeave ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No leave requests are waiting.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(pendingLeave ?? []).slice(0, 5).map((request) => (
                    <li key={request.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{request.employee?.name ?? '—'}</span>
                      <span className="text-muted-foreground">
                        {request.days_count}d · {request.start_date}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-1 self-start">
                <Link to={ROUTES.hrLeave}>Open Leave Requests</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="font-semibold">Upcoming Holidays</h2>
              {upcomingHolidays.length === 0 ? (
                <p className="text-muted-foreground text-sm">No holidays are scheduled.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {upcomingHolidays.map((holiday) => (
                    <li key={holiday.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{holiday.name}</span>
                      <span className="text-muted-foreground">
                        {holiday.start_date} · {holiday.days}d
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 pt-6">
              <h2 className="font-semibold">Workforce</h2>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link to={ROUTES.hrEmployees}>
                  <Users className="size-4" />
                  Employees
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link to={ROUTES.hrOrganizationChart}>
                  <Network className="size-4" />
                  Organization Chart
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link to={ROUTES.hrStructure}>
                  <UserCheck className="size-4" />
                  Departments &amp; Positions
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
