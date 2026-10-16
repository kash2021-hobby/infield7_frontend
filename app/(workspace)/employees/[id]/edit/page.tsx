"use client";

import { useParams } from "next/navigation";
import { PersonalIdForm } from "@/lib/personal-id-form";

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  return <PersonalIdForm employeeId={params.id} />;
}
