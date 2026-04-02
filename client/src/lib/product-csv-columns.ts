export interface CsvColumn {
  key: string;
  header: string;
  required: boolean;
  description: string;
  example: string;
  example2: string;
  parse?: (raw: string) => unknown;
  validate?: (value: unknown) => string | null;
}

export const PRODUCT_CSV_COLUMNS: CsvColumn[] = [
  {
    key: "title",
    header: "nombre",
    required: true,
    description: "Nombre del producto (obligatorio, único por sucursal)",
    example: "Coca-Cola 500ml",
    example2: "Pan lactal integral",
    validate: (v) => (!v || String(v).trim() === "" ? "El nombre es obligatorio" : null),
  },
  {
    key: "description",
    header: "descripcion",
    required: false,
    description: "Descripción o detalle del producto",
    example: "Bebida gaseosa 500ml sabor original",
    example2: "Pan de molde integral sin corteza",
    parse: (raw) => raw.trim() || "",
    validate: () => null,
  },
  {
    key: "price",
    header: "precio",
    required: true,
    description: "Precio de venta (número, sin símbolo $)",
    example: "1500",
    example2: "850.50",
    parse: (raw) => {
      const cleaned = raw.replace(",", ".").trim();
      return isNaN(Number(cleaned)) ? raw : Number(cleaned);
    },
    validate: (v) => {
      const n = Number(v);
      if (isNaN(n) || n < 0) return "El precio debe ser un número mayor o igual a 0";
      return null;
    },
  },
  {
    key: "stock",
    header: "stock",
    required: false,
    description: "Cantidad inicial en stock (por defecto: 0)",
    example: "100",
    example2: "50.5",
    parse: (raw) => {
      if (raw.trim() === "") return 0;
      const cleaned = raw.replace(",", ".").trim();
      return isNaN(Number(cleaned)) ? raw : Number(cleaned);
    },
    validate: (v) => {
      const n = Number(v);
      if (isNaN(n) || n < 0) return "El stock debe ser un número mayor o igual a 0";
      return null;
    },
  },
  {
    key: "unitType",
    header: "tipo_unidad",
    required: false,
    description: "Tipo de unidad: unidad | gramos | litros (por defecto: unidad)",
    example: "unidad",
    example2: "gramos",
    parse: (raw) => {
      const val = raw.trim().toLowerCase();
      return ["unidad", "gramos", "litros"].includes(val) ? val : "unidad";
    },
    validate: (v) => {
      if (!v || !["unidad", "gramos", "litros"].includes(String(v))) {
        return "El tipo de unidad debe ser: unidad, gramos o litros";
      }
      return null;
    },
  },
  {
    key: "barcode",
    header: "codigo_barras",
    required: false,
    description: "Código de barras (opcional, debe ser único por sucursal)",
    example: "7790895000118",
    example2: "",
    parse: (raw) => raw.trim() || undefined,
    validate: () => null,
  },
];

export function generateCsvTemplate(): string {
  const headers = PRODUCT_CSV_COLUMNS.map((c) => c.header).join(",");
  const ex1 = PRODUCT_CSV_COLUMNS.map((c) => `"${c.example}"`).join(",");
  const ex2 = PRODUCT_CSV_COLUMNS.map((c) => `"${c.example2}"`).join(",");
  return `${headers}\n${ex1}\n${ex2}\n`;
}

export function parseCsvRow(
  row: Record<string, string>
): { data: Record<string, unknown>; errors: string[] } {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const col of PRODUCT_CSV_COLUMNS) {
    const raw = row[col.header] ?? "";
    const parsed = col.parse ? col.parse(raw) : raw.trim() || undefined;

    if (col.required && (parsed === undefined || parsed === null || parsed === "")) {
      errors.push(`"${col.header}": ${col.validate ? col.validate(parsed) : "Campo obligatorio"}`);
      data[col.key] = parsed;
      continue;
    }

    const err = col.validate ? col.validate(parsed) : null;
    if (err) errors.push(`"${col.header}": ${err}`);
    data[col.key] = parsed;
  }

  return { data, errors };
}

export function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const rawHeaders = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
