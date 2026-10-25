"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { saveWorkAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

const workFormSchema = z.object({
  codigo: z.string().trim().min(2, "Informe um código."),
  nome: z.string().trim().min(2, "Informe o nome da obra."),
  cliente: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2, "Use a sigla do estado.").optional(),
  data_inicio: z.string().optional(),
  data_fim_prevista: z.string().optional(),
  valor_contrato: z.number().nonnegative("O valor deve ser positivo.").nullable(),
  status: z.enum(["planejamento", "em_andamento", "paralisada", "concluida"]),
});

type WorkFormValues = z.infer<typeof workFormSchema>;
type WorkValues = WorkFormValues & { id?: string };

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10";

export function WorkForm({
  initialValues,
  isEditing = false,
}: {
  initialValues?: Partial<WorkValues>;
  isEditing?: boolean;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<WorkFormValues>({
    resolver: zodResolver(workFormSchema),
    defaultValues: {
      codigo: initialValues?.codigo ?? "",
      nome: initialValues?.nome ?? "",
      cliente: initialValues?.cliente ?? "",
      endereco: initialValues?.endereco ?? "",
      cidade: initialValues?.cidade ?? "",
      uf: initialValues?.uf ?? "",
      data_inicio: initialValues?.data_inicio ?? "",
      data_fim_prevista: initialValues?.data_fim_prevista ?? "",
      valor_contrato: initialValues?.valor_contrato ?? null,
      status: initialValues?.status ?? "planejamento",
    },
  });

  const submit = handleSubmit((values) => {
    setError("");
    startTransition(async () => {
      const result = await saveWorkAction({ ...values, id: initialValues?.id });
      if (result.error) setError(result.error);
    });
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-7">
        <div className="mb-6">
          <h2 className="font-bold text-slate-900">Identificação</h2>
          <p className="mt-1 text-xs text-slate-500">Dados principais do projeto e do cliente.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Código da obra" error={errors.codigo?.message}>
            <input {...register("codigo")} className={fieldClass} placeholder="Ex.: OBX-003" />
          </Field>
          <Field label="Nome da obra" error={errors.nome?.message}>
            <input {...register("nome")} className={fieldClass} placeholder="Ex.: Residencial Parque" />
          </Field>
          <Field label="Cliente">
            <input {...register("cliente")} className={fieldClass} placeholder="Nome do cliente" />
          </Field>
          <Field label="Valor do contrato" error={errors.valor_contrato?.message}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">R$</span>
              <input
                {...register("valor_contrato", { setValueAs: (value) => value === "" ? null : Number(value) })}
                type="number"
                min="0"
                step="0.01"
                className={`${fieldClass} pl-10`}
                placeholder="0,00"
              />
            </div>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-7">
        <div className="mb-6">
          <h2 className="font-bold text-slate-900">Local e cronograma</h2>
          <p className="mt-1 text-xs text-slate-500">Endereço e previsão de execução da obra.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Endereço" className="sm:col-span-2">
            <input {...register("endereco")} className={fieldClass} placeholder="Rua, número e complemento" />
          </Field>
          <Field label="Cidade">
            <input {...register("cidade")} className={fieldClass} placeholder="Cidade" />
          </Field>
          <Field label="Estado (UF)">
            <input {...register("uf")} maxLength={2} className={fieldClass} placeholder="SP" />
          </Field>
          <Field label="Data de início">
            <input {...register("data_inicio")} type="date" className={fieldClass} />
          </Field>
          <Field label="Previsão de entrega">
            <input {...register("data_fim_prevista")} type="date" className={fieldClass} />
          </Field>
          <Field label="Status">
            <select {...register("status")} className={fieldClass}>
              <option value="planejamento">Planejamento</option>
              <option value="em_andamento">Em andamento</option>
              <option value="paralisada">Paralisada</option>
              <option value="concluida">Concluída</option>
            </select>
          </Field>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <Button asChild variant="outline"><Link href={isEditing && initialValues?.id ? `/app/obras/${initialValues.id}` : "/app/obras"}><ArrowLeft size={16} /> Cancelar</Link></Button>
        <Button type="submit" disabled={isPending}><Save size={16} />{isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar obra"}</Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {error && <span className="block text-xs text-rose-600">{error}</span>}
    </label>
  );
}
