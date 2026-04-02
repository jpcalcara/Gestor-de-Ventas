import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, Download, FileText, AlertCircle, CheckCircle2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  PRODUCT_CSV_COLUMNS,
  generateCsvTemplate,
  parseCsvText,
  parseCsvRow,
} from "@/lib/product-csv-columns";

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  data: Record<string, unknown>;
  errors: string[];
}

interface ImportResult {
  row: number;
  title: string;
  success: boolean;
  error?: string;
}

type Step = "template" | "upload" | "preview" | "results";

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductImportDialog({ open, onOpenChange }: ProductImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("template");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);

  const importMutation = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      const products = rows
        .filter((r) => r.errors.length === 0)
        .map((r) => r.data);
      return await apiRequest("POST", "/api/products/import", { products }) as { results: ImportResult[] };
    },
    onSuccess: (data) => {
      setResults(data.results);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Error al importar", description: error.message, variant: "destructive" });
    },
  });

  const handleDownloadTemplate = () => {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_productos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsvText(text);
      const parsed: ParsedRow[] = rows.map((row, i) => {
        const { data, errors } = parseCsvRow(row);
        return { rowIndex: i + 2, raw: row, data, errors };
      });
      setParsedRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleReset = () => {
    setStep("template");
    setParsedRows([]);
    setFileName("");
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Importar productos desde CSV</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b text-sm">
          {(["template", "upload", "preview", "results"] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = {
              template: "Plantilla",
              upload: "Archivo",
              preview: "Vista previa",
              results: "Resultado",
            };
            const done = (
              step === "upload" && i === 0 ||
              step === "preview" && i <= 1 ||
              step === "results" && i <= 2
            );
            const active = step === s;
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={`${active ? "text-foreground font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {labels[s]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* STEP: Template */}
          {step === "template" && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                El archivo CSV debe tener una fila de encabezado con los nombres de columna exactos.
                Las columnas marcadas con <span className="text-destructive font-medium">*</span> son obligatorias.
                Las opcionales pueden omitirse o dejarse vacías.
              </p>

              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Columna</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Descripción</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ejemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCT_CSV_COLUMNS.map((col, i) => (
                      <tr key={col.key} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs">{col.header}</span>
                          {col.required && <span className="text-destructive ml-0.5">*</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell text-xs">{col.description}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{col.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vista previa del archivo</p>
                <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
                  {generateCsvTemplate()}
                </pre>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar plantilla
                </Button>
                <Button onClick={() => setStep("upload")} data-testid="button-go-upload">
                  Tengo el archivo listo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Upload */}
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Seleccioná el archivo CSV con tus productos. El archivo debe seguir el formato de la plantilla.
              </p>

              <label
                htmlFor="csv-upload"
                className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                data-testid="label-csv-upload"
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Haz clic para seleccionar el CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Solo archivos .csv</p>
                <input
                  id="csv-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-csv-file"
                />
              </label>

              <Button variant="outline" onClick={() => setStep("template")}>
                Volver a plantilla
              </Button>
            </div>
          )}

          {/* STEP: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{fileName}</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="default" data-testid="badge-valid-rows">
                    {validRows.length} {validRows.length === 1 ? "fila válida" : "filas válidas"}
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge variant="destructive" data-testid="badge-invalid-rows">
                      {invalidRows.length} con errores
                    </Badge>
                  )}
                </div>
              </div>

              {parsedRows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  El archivo no tiene filas de datos. Revisá que tenga al menos una fila de encabezado y una de datos.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10">#</th>
                          {PRODUCT_CSV_COLUMNS.slice(0, 5).map((col) => (
                            <th key={col.key} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                              {col.header}
                            </th>
                          ))}
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={row.errors.length > 0 ? "bg-destructive/5" : ""}
                            data-testid={`row-preview-${row.rowIndex}`}
                          >
                            <td className="px-3 py-2 text-muted-foreground">{row.rowIndex}</td>
                            {PRODUCT_CSV_COLUMNS.slice(0, 5).map((col) => (
                              <td key={col.key} className="px-3 py-2 max-w-[140px] truncate" title={String(row.raw[col.header] ?? "")}>
                                {row.raw[col.header] || <span className="text-muted-foreground/50">—</span>}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              {row.errors.length === 0 ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>OK</span>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  {row.errors.map((err, ei) => (
                                    <div key={ei} className="flex items-start gap-1 text-destructive">
                                      <X className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invalidRows.length > 0 && validRows.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-700 dark:text-yellow-400">
                    Solo se importarán las <strong>{validRows.length}</strong> filas válidas.
                    Las {invalidRows.length} con errores serán omitidas.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setStep("upload"); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                >
                  Cambiar archivo
                </Button>
                <Button
                  disabled={validRows.length === 0 || importMutation.isPending}
                  onClick={() => importMutation.mutate(parsedRows)}
                  data-testid="button-confirm-import"
                >
                  {importMutation.isPending
                    ? "Importando..."
                    : `Importar ${validRows.length} ${validRows.length === 1 ? "producto" : "productos"}`}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Results */}
          {step === "results" && (
            <div className="space-y-4">
              <div className="flex gap-3">
                {successCount > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 flex-1">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        {successCount} {successCount === 1 ? "producto importado" : "productos importados"}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-500">Ya están disponibles en tu inventario</p>
                    </div>
                  </div>
                )}
                {failCount > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 flex-1">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        {failCount} {failCount === 1 ? "producto con error" : "productos con error"}
                      </p>
                      <p className="text-xs text-destructive/80">Ver detalle abajo</p>
                    </div>
                  </div>
                )}
              </div>

              {failCount > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <div className="bg-muted/50 border-b px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Errores de importación
                  </div>
                  <div className="divide-y">
                    {results.filter((r) => !r.success).map((r) => (
                      <div key={r.row} className="flex items-start gap-3 px-4 py-3">
                        <X className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Fila {r.row}: {r.title || "(sin nombre)"}</p>
                          <p className="text-xs text-muted-foreground">{r.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} data-testid="button-import-again">
                  Importar otro archivo
                </Button>
                <Button onClick={() => { onOpenChange(false); handleReset(); }} data-testid="button-close-import">
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
