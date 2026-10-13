import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { MEDIA_URL, useAuth, type Branch } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";

type Category = { id: string; name: string; defaultUnit?: string };
type Row = { rowNumber: number; sku: string; name: string; category: string; categoryId: string | null; quantity: string; buyPrice: string; sellPrice: string; acknowledgedMatches?: string | null };
type ProductMatch = { id: string; name: string; sku: string; imageUrl: string | null; category: string; isDeleted: boolean; status: string; skuMatch: boolean; exactNameMatch: boolean; similarNameMatch: boolean };
type RowMatches = { rowNumber: number; products: ProductMatch[]; total: number; skuCount: number; exactNameCount: number; similarNameCount: number; reviewKey: string | null };
type RowError = { rowNumber: number; field: string; message: string };
type Preview = { rows: Row[]; errors: RowError[]; matches?: RowMatches[]; importId?: string };
const matchSignature = (rows: Row[]) => JSON.stringify(rows.map(r => [r.rowNumber, r.name, r.sku]));
const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function BulkProductsScreen() {
  const { session } = useAuth();
  return <ImportScreen key={`${session?.businessId}:${session?.branchId}`} />;
}

function ImportScreen() {
  const auth = useAuth();
  const { lang } = useLanguage();
  const say = (en: string, bn: string) => lang === "bn" ? bn : en;
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(auth.session?.branchId ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [importId, setImportId] = useState("");
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [success, setSuccess] = useState<number | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [matches, setMatches] = useState<RowMatches[]>([]);
  const [checkedSignature, setCheckedSignature] = useState("");
  const [matchError, setMatchError] = useState("");
  const [matchRetry, setMatchRetry] = useState(0);
  const apiRef = useRef(auth.api); apiRef.current = auth.api;
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const signature = matchSignature(rows);
  const matching = rows.length > 0 && signature !== checkedSignature;
  const actionLock = useRef(false);
  const mounted = useRef(true);
  const isOwner = auth.session?.user.role?.toUpperCase() === "OWNER";
  useEffect(() => {
    if (step !== 2 || !rowsRef.current.length || signature === checkedSignature) return;
    let active = true;
    setMatchError("");
    const timer = setTimeout(async () => {
      try {
        const result = await apiRef.current<{ matches: RowMatches[]; errors: RowError[] }>("/products/import/matches", {
          method: "POST", body: JSON.stringify({ rows: rowsRef.current, importId, branchId: null }),
        });
        if (!active) return;
        setMatches(result.matches); setCheckedSignature(signature);
        setErrors(previous => [...previous.filter(e => e.field !== "sku" && e.field !== "name" && e.field !== "matches"), ...result.errors]);
      } catch (e) { if (active) setMatchError((e as Error).message); }
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [signature, checkedSignature, step, matchRetry, importId]);

  function acceptMatches(preview: Preview) {
    setMatches(preview.matches ?? []); setCheckedSignature(matchSignature(preview.rows)); setMatchError("");
  }
  useEffect(() => {
    mounted.current = true;
    if (isOwner) void load();
    return () => { mounted.current = false; };
  }, []);
  async function load() {
    setError("");
    try {
      const [cats, locations] = await Promise.all([auth.api<Category[]>("/categories"), auth.api<Branch[]>("/branches/mine")]);
      if (!mounted.current) return;
      setCategories(cats);
      const active = locations.filter(b => b.isActive !== false);
      setBranches(active);
      if (!branchId && active.length === 1) setBranchId(active[0].id);
      setLoaded(true);
    } catch (e) { if (mounted.current) setError((e as Error).message); }
  }
  async function run(label: string, task: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(label); setError("");
    try { await task(); }
    catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { actionLock.current = false; if (mounted.current) setBusy(""); }
  }
  async function download(report = false) {
    await run("download", async () => {
      const file = await auth.api<{ fileName: string; base64: string }>(report ? "/products/import/errors" : "/products/import/template", report ? { method: "POST", body: JSON.stringify({ rows, branchId: branchId || null, importId, categoryId: categoryId || null }) } : undefined);
      if (Platform.OS === "web") {
        const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.fileName;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else {
        const uri = `${FileSystem.cacheDirectory}${file.fileName}`;
        await FileSystem.writeAsStringAsync(uri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
        if (!await Sharing.isAvailableAsync()) throw new Error(say("File sharing is not available on this device.", "এই ডিভাইসে ফাইল শেয়ার করা যাচ্ছে না।"));
        await Sharing.shareAsync(uri, { mimeType: mime, UTI: "org.openxmlformats.spreadsheetml.sheet" });
      }
    });
  }
  async function upload() {
    await run("upload", async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: mime, copyToCacheDirectory: true, multiple: false, base64: false });
      if (result.canceled) return;
      const file = result.assets[0];
      if (Platform.OS === "web") URL.revokeObjectURL(file.uri);
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error(say("Choose an Excel (.xlsx) file.", "একটি Excel (.xlsx) ফাইল নির্বাচন করুন।"));
      if ((file.size ?? 0) > 5 * 1024 * 1024) throw new Error(say("Maximum file size is 5 MB.", "ফাইলের সর্বোচ্চ আকার ৫ MB।"));
      let base64: string;
      if (Platform.OS === "web") {
        if (!file.file) throw new Error("Could not read the selected file.");
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("Could not read the selected file.")); reader.readAsDataURL(file.file!);
        });
      } else base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const preview = await auth.api<Preview>("/products/import/preview", { method: "POST", body: JSON.stringify({ fileName: file.name, base64 }) });
      if (!mounted.current) return;
      acceptMatches(preview);
      setRows(preview.rows.map(row => ({ ...row, categoryId: categoryId || null, category: categories.find(c => c.id === categoryId)?.name ?? "" }))); setErrors(preview.errors); setImportId(preview.importId!); setFileName(file.name);
      setStep(2); setSuccess(null); setOnlyErrors(false); setUncertain(false);
    });
  }
  function edit(rowNumber: number, patch: Partial<Row>) {
    if ("name" in patch || "sku" in patch) patch.acknowledgedMatches = null;
    setRows(previous => previous.map(row => row.rowNumber === rowNumber ? { ...row, ...patch } : row));
    // File duplicates are recalculated from current values so both red cells clear together.
    setErrors(previous => previous.filter(e => e.message !== "SKU appears more than once in this file." && (e.rowNumber !== rowNumber || !(e.field in patch))));
  }
  async function review() {
    if (!categoryId || !categories.some(c => c.id === categoryId)) {
      setError(say("Select a category for all products.", "সব পণ্যের জন্য একটি ক্যাটাগরি নির্বাচন করুন।")); return;
    }
    await run("validate", async () => {
      const preview = await auth.api<Preview>("/products/import/validate", { method: "POST", body: JSON.stringify({ rows, branchId: branchId || null, importId, categoryId }) });
      if (!mounted.current) return;
      setRows(preview.rows); setErrors(preview.errors); acceptMatches(preview);
      if (!preview.errors.length && branchId) setStep(3);
      else setError(!branchId ? say("Select a branch for opening stock.", "প্রাথমিক স্টকের জন্য একটি শাখা নির্বাচন করুন।") : say("Correct the highlighted rows, then check again.", "চিহ্নিত সারিগুলো সংশোধন করে আবার যাচাই করুন।"));
    });
  }
  async function save() {
    await run("save", async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const result = await auth.api<{ productIds: string[] }>("/products/import/save", {
          method: "POST", body: JSON.stringify({ rows, branchId, importId, categoryId }), signal: controller.signal,
        });
        if (mounted.current) { setSuccess(result.productIds.length); setUncertain(false); }
      } catch (e) {
        if (!mounted.current) return;
        const failure = e as Error & { status?: number; data?: { preview?: Preview } };
        if (failure.data?.preview) {
          setRows(failure.data.preview.rows); setErrors(failure.data.preview.errors); acceptMatches(failure.data.preview); setStep(2); setUncertain(false);
        } else if (!failure.status || failure.status >= 500) {
          setUncertain(true);
          throw new Error(say("The save result could not be confirmed. Retry this same batch safely; products will not be created twice.", "সংরক্ষণের ফল নিশ্চিত করা যায়নি। একই ব্যাচ আবার চেষ্টা করুন; পণ্য দুইবার তৈরি হবে না।"));
        } else setUncertain(false);
        throw e;
      } finally { clearTimeout(timer); }
    });
  }
  const duplicateSkus = new Set(rows.filter(row => row.sku.trim() && rows.filter(other => other.sku.trim().toLowerCase() === row.sku.trim().toLowerCase()).length > 1).map(row => row.rowNumber));
  const cellErrors = errors.filter(e => e.field !== "categoryId" && e.message !== "SKU appears more than once in this file.");
  const invalidRows = new Set([...cellErrors.map(e => e.rowNumber), ...duplicateSkus,
    ...(!matching ? matches.filter(m => m.reviewKey && rows.find(r => r.rowNumber === m.rowNumber)?.acknowledgedMatches !== m.reviewKey).map(m => m.rowNumber) : [])]);
  const selectedCategory = categories.find(c => c.id === categoryId);
  const pendingSteps: string[] = [];
  if (!rows.length) pendingSteps.push(say("Please upload at least one product.", "অনুগ্রহ করে অন্তত একটি পণ্য আপলোড করুন।"));
  if (!selectedCategory) pendingSteps.push(say("Please select the category for all products.", "অনুগ্রহ করে সব পণ্যের জন্য ক্যাটাগরি নির্বাচন করুন।"));
  if (!branchId) pendingSteps.push(say("Please select the branch for opening stock.", "অনুগ্রহ করে প্রাথমিক স্টকের জন্য শাখা নির্বাচন করুন।"));
  if (duplicateSkus.size) pendingSteps.push(say("Please correct the duplicate SKUs marked in red in your uploaded file.", "আপলোড করা ফাইলে লাল চিহ্নিত একই SKU-গুলো সংশোধন করুন।"));
  if (matching) pendingSteps.push(matchError
    ? say("Please click ‘Retry match check’ to complete the database check.", "ডেটাবেস যাচাই শেষ করতে ‘আবার মিল যাচাই করুন’ চাপুন।")
    : say("Please wait for the product name and SKU checks to finish.", "পণ্যের নাম ও SKU যাচাই শেষ হওয়া পর্যন্ত অপেক্ষা করুন।"));
  if (!matching) {
    const currentMatches = matches.filter(m => rows.some(r => r.rowNumber === m.rowNumber));
    const skuRows = currentMatches.filter(m => m.skuCount > 0).map(m => m.rowNumber - 1).join(", ");
    const nameRows = currentMatches.filter(m => m.exactNameCount > 0).map(m => m.rowNumber - 1).join(", ");
    const reviewRows = currentMatches.filter(m => m.reviewKey && !m.skuCount && !m.exactNameCount && rows.find(r => r.rowNumber === m.rowNumber)?.acknowledgedMatches !== m.reviewKey).map(m => m.rowNumber - 1).join(", ");
    if (skuRows) pendingSteps.push(say(`Please change the SKUs already in the database, or remove rows: ${skuRows}.`, `ডেটাবেসে থাকা SKU পরিবর্তন করুন অথবা সারিগুলো বাদ দিন: ${skuRows}।`));
    if (nameRows) pendingSteps.push(say(`Please change the exact matching product names, or remove rows: ${nameRows}.`, `হুবহু মিলে যাওয়া পণ্যের নাম পরিবর্তন করুন অথবা সারিগুলো বাদ দিন: ${nameRows}।`));
    if (reviewRows) pendingSteps.push(say(`Please expand the similar-name matches and tick ‘I reviewed these matches’ for rows: ${reviewRows}.`, `কাছাকাছি নামের মিলগুলো খুলে ‘মিলগুলো যাচাই করেছি’ টিক দিন। সারি: ${reviewRows}।`));
  }
  if (busy) pendingSteps.push(say("Please wait for the current action to finish.", "চলমান কাজ শেষ হওয়া পর্যন্ত অপেক্ষা করুন।"));
  const fields: { key: "sku" | "name" | "quantity" | "buyPrice" | "sellPrice"; label: string; width: number }[] = [
    { key: "sku", label: say("Product SKU", "পণ্যের SKU"), width: 130 },
    { key: "name", label: say("Product Name", "পণ্যের নাম"), width: 190 },
    { key: "quantity", label: say("Initial Quantity", "প্রাথমিক পরিমাণ"), width: 120 },
    { key: "buyPrice", label: say("Buy Price", "ক্রয়মূল্য"), width: 100 },
    { key: "sellPrice", label: say("Sell Price", "বিক্রয়মূল্য"), width: 100 },
  ];
  const businessName = auth.session?.businesses.find(b => b.id === auth.session?.businessId)?.name;
  const branchName = branches.find(b => b.id === branchId)?.name ?? auth.session?.branchName;
  const disabled = !!busy;
  const button = (label: string, action: () => void, secondary = false, blocked = false) => <Pressable accessibilityRole="button" disabled={disabled || blocked} onPress={action} style={[s.button, secondary && s.secondaryButton, (disabled || blocked) && s.disabled]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text></Pressable>;
  if (!isOwner) return <View style={s.content}><Text>{say("Only the business owner can import products.", "শুধু ব্যবসার মালিক পণ্য আপলোড করতে পারবেন।")}</Text></View>;
  return <View style={s.root}>
    <View style={s.header}><Pressable accessibilityLabel="Back to Quick Add Products" disabled={busy === "save" || uncertain} onPress={() => router.replace("/more/catalog-templates")}><Ionicons name="arrow-back" size={23} color={colors.heading} /></Pressable><View style={s.grow}><Text style={s.title}>{say("Bulk Upload Products", "একসাথে পণ্য আপলোড")}</Text><Text style={s.muted}>{say("Excel only · Up to 50 new products", "শুধু Excel · সর্বোচ্চ ৫০টি নতুন পণ্য")}</Text></View></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.steps}>{[say("Upload", "আপলোড"), say("Review & Categories", "যাচাই ও ক্যাটাগরি"), say("Save", "সংরক্ষণ")].map((label, i) => <View key={i} style={[s.step, step === i + 1 && s.activeStep]}><Text style={[s.stepText, step === i + 1 && s.activeText]}>{i + 1}. {label}</Text></View>)}</View>
      {!!error && <View accessibilityLiveRegion="polite" style={s.errorBox}><Text style={s.error}>{error}</Text></View>}
      {!!busy && <View style={s.inline}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>{busy === "save" ? say("Saving products and opening stock…", "পণ্য ও প্রাথমিক স্টক সংরক্ষণ হচ্ছে…") : say("Please wait…", "অনুগ্রহ করে অপেক্ষা করুন…")}</Text></View>}
      {!loaded ? <View style={s.card}><Text>{say("Loading categories and branches…", "ক্যাটাগরি ও শাখা লোড হচ্ছে…")}</Text>{!!error && button(say("Retry", "আবার চেষ্টা করুন"), () => void load(), true)}</View> : success !== null ? <View style={s.card}><Ionicons name="checkmark-circle" size={48} color={colors.success} /><Text style={s.title}>{say(`${success} products created successfully`, `${success}টি পণ্য সফলভাবে তৈরি হয়েছে`)}</Text><Text style={s.muted}>{businessName} · {branchName}</Text>{button(say("View Products", "পণ্য দেখুন"), () => router.replace("/products"))}{button(say("Upload another file", "আরেকটি ফাইল আপলোড"), () => { setStep(1); setRows([]); setSuccess(null); setError(""); }, true)}</View> : <>
        {step === 1 && <>
          <View style={s.card}><View style={s.icon}><Ionicons name="document-text-outline" size={30} color={colors.primaryDark} /></View><Text style={s.title}>{say("Start with the Excel template", "Excel টেমপ্লেট দিয়ে শুরু করুন")}</Text><Text style={s.description}>{say("Download the template, enter one product per row, then upload it here. Choose one category for the entire batch after uploading.", "টেমপ্লেট ডাউনলোড করে প্রতি সারিতে একটি পণ্য লিখুন, তারপর এখানে আপলোড করুন। আপলোডের পর ক্যাটাগরি নির্বাচন করা যাবে।")}</Text>{button(say("Download Excel Template", "Excel টেমপ্লেট ডাউনলোড"), () => void download(), true)}<View style={s.divider} /><Text style={s.label}>{say("Required product details", "প্রয়োজনীয় পণ্যের তথ্য")}</Text><Text style={s.description}>{say("Product SKU · Product Name · Initial Quantity · Buy Price · Sell Price", "পণ্যের SKU · পণ্যের নাম · প্রাথমিক পরিমাণ · ক্রয়মূল্য · বিক্রয়মূল্য")}</Text><Text style={s.muted}>{say("Keep SKU codes as text to preserve leading zeros. Select one category in the review screen for all products.", "শুরুর শূন্য বজায় রাখতে SKU টেক্সট হিসেবে রাখুন। যাচাইয়ের সময় সব পণ্যের জন্য একটি ক্যাটাগরি নির্বাচন করুন।")}</Text></View>
          <View style={[s.card, s.uploadCard]}><Ionicons name="cloud-upload-outline" size={38} color={colors.primaryDark} /><Text style={s.title}>{say("Upload your products", "আপনার পণ্য আপলোড করুন")}</Text><Text style={s.muted}>{say(".xlsx only · Maximum 5 MB · Maximum 50 products", "শুধু .xlsx · সর্বোচ্চ ৫ MB · সর্বোচ্চ ৫০টি পণ্য")}</Text>{button(say("Choose Excel File", "Excel ফাইল নির্বাচন"), () => void upload())}</View>
        </>}
        {step === 2 && <>
          <View style={s.card}>
            <Text style={s.label}>{say("Category *", "ক্যাটাগরি *")}</Text>
            <Choice label={say("Select category for all products", "সব পণ্যের ক্যাটাগরি নির্বাচন")} value={categoryId} options={categories} onSelect={id => {
              setCategoryId(id);
              setRows(current => current.map(row => ({ ...row, categoryId: id, category: categories.find(c => c.id === id)!.name })));
              setErrors(current => current.filter(e => e.field !== "categoryId"));
            }} disabled={disabled} />
            <Text style={s.muted}>{selectedCategory ? `${say("Applies to all products · Unit", "সব পণ্যের জন্য প্রযোজ্য · একক")}: ${selectedCategory.defaultUnit || "pcs"}` : say("Required. All products in this upload will use this category.", "আবশ্যক। এই আপলোডের সব পণ্য একই ক্যাটাগরিতে যোগ হবে।")}</Text>
            <Text style={s.label}>{say("Opening stock destination", "প্রাথমিক স্টকের গন্তব্য")}</Text>
            <Text style={s.muted}>{businessName}</Text>
            {auth.session?.branchId ? <Text>{branchName}</Text> : <Choice label={say("Select branch", "শাখা নির্বাচন")} value={branchId} options={branches} onSelect={setBranchId} disabled={disabled} />}
          </View>
          <View style={s.tablePanel}>
            <View style={s.tableToolbar}>
              <Text style={s.title}>{say(`${rows.length} products found`, `${rows.length}টি পণ্য পাওয়া গেছে`)}</Text>
              <Text style={s.muted}>{fileName}</Text>
              <Text style={s.muted}>{say("Edit cells directly. Red cells need correction. Swipe sideways to see all columns.", "সরাসরি ঘরে সম্পাদনা করুন। লাল ঘরগুলো সংশোধন করুন। সব কলাম দেখতে পাশে স্ক্রল করুন।")}</Text>
              <View style={s.actions}>{button(say("Replace file", "ফাইল পরিবর্তন"), () => void upload(), true)}{button(onlyErrors ? say("Show all rows", "সব সারি দেখুন") : say("Show rows with errors", "ত্রুটিযুক্ত সারি দেখুন"), () => setOnlyErrors(!onlyErrors), true)}</View>
            </View>
            <ScrollView horizontal keyboardShouldPersistTaps="handled">
              <View>
                <View style={[s.tableRow, s.tableHeading]}>
                  <Text style={[s.columnHeading, { width: 40 }]}>#</Text>
                  {fields.map(field => <Text key={field.key} style={[s.columnHeading, { width: field.width }]}>{field.label} *</Text>)}
                  <View style={{ width: 40 }} />
                </View>
                {rows.filter(row => !onlyErrors || invalidRows.has(row.rowNumber)).map(row => <View key={row.rowNumber}><View style={s.tableRow}>
                  <View style={s.rowNumber}><Text style={s.muted}>{row.rowNumber - 1}</Text></View>
                  {fields.map(field => {
                    const issues = cellErrors.filter(e => e.rowNumber === row.rowNumber && e.field === field.key);
                    const invalid = issues.length > 0 || (field.key === "sku" && duplicateSkus.has(row.rowNumber));
                    return <View key={field.key} style={[s.tableCell, { width: field.width }]}>
                      <TextInput accessibilityLabel={`Row ${row.rowNumber}: ${field.label}`} accessibilityHint={invalid ? (field.key === "sku" ? say("SKU needs correction", "SKU সংশোধন করুন") : issues.map(e => e.message).join(" ")) : undefined} aria-invalid={invalid} editable={!disabled} value={row[field.key]} onChangeText={value => edit(row.rowNumber, { [field.key]: value })} keyboardType={field.key === "sku" || field.key === "name" ? "default" : "decimal-pad"} autoCapitalize="none" style={[s.cellInput, field.key !== "sku" && field.key !== "name" && s.numericCell, invalid && s.invalidInput]} />
                      {field.key !== "sku" && issues.map((issue, index) => <Text key={index} style={s.cellError}>{issue.message}</Text>)}
                    </View>;
                  })}
                  <Pressable disabled={disabled} accessibilityLabel={`Remove row ${row.rowNumber}`} onPress={() => {
                    setRows(current => current.filter(r => r.rowNumber !== row.rowNumber));
                    setErrors(current => current.filter(e => e.rowNumber !== row.rowNumber && e.message !== "SKU appears more than once in this file."));
                  }} style={s.removeCell}><Ionicons name="close" size={18} color={colors.secondary} /></Pressable>
                </View>
                  {!matching && <MatchNotice match={matches.find(m => m.rowNumber === row.rowNumber)} acknowledged={row.acknowledgedMatches} disabled={disabled} onAcknowledge={key => edit(row.rowNumber, { acknowledgedMatches: key })} />}
                </View>)}
              </View>
            </ScrollView>
          </View>
          {matching && !matchError && <Text style={s.muted}>{say("Checking product names and SKUs…", "পণ্যের নাম ও SKU যাচাই হচ্ছে…")}</Text>}
          {!!matchError && <View style={s.errorBox}><Text style={s.error}>{matchError}</Text>{button(say("Retry match check", "আবার মিল যাচাই করুন"), () => setMatchRetry(v => v + 1), true)}</View>}
          {!!invalidRows.size && button(say("Download Error Report", "ত্রুটির রিপোর্ট ডাউনলোড"), () => void download(true), true)}
          {onlyErrors && !invalidRows.size && <Text style={s.muted}>{say("No highlighted errors. Check again to validate your changes.", "চিহ্নিত ত্রুটি নেই। পরিবর্তনগুলো আবার যাচাই করুন।")}</Text>}
          {!!pendingSteps.length && <View accessibilityLiveRegion="polite" style={s.pendingBox}>
            <Text style={s.label}>{say("Before you continue", "এগিয়ে যাওয়ার আগে")}</Text>
            {pendingSteps.map(message => <View key={message} style={s.pendingRow}><Text style={s.matchWarningText}>•</Text><Text style={[s.matchWarningText, s.grow]}>{message}</Text></View>)}
          </View>}
          {button(say("Check & Continue", "যাচাই করে এগিয়ে যান"), () => void review(), false, pendingSteps.length > 0)}
        </>}
        {step === 3 && <View style={s.card}><Ionicons name="checkmark-done-circle-outline" size={40} color={colors.success} /><Text style={s.title}>{say(`${rows.length} products ready to save`, `${rows.length}টি পণ্য সংরক্ষণের জন্য প্রস্তুত`)}</Text><Text style={s.description}>{businessName} · {branchName} · {selectedCategory?.name}</Text><Text style={s.description}>{say("All rows have valid values and share the selected category. Products, opening stock and buying costs will be saved together. Existing products will not be changed.", "সব সারির তথ্য ও ক্যাটাগরি সঠিক। পণ্য, প্রাথমিক স্টক ও ক্রয়মূল্য একসাথে সংরক্ষিত হবে। বিদ্যমান পণ্য পরিবর্তন হবে না।")}</Text>{button(uncertain ? say("Retry Save Safely", "নিরাপদে আবার সংরক্ষণ করুন") : say(`Save ${rows.length} Products`, `${rows.length}টি পণ্য সংরক্ষণ`), () => void save())}{!uncertain && button(say("Back to Review", "যাচাইয়ে ফিরে যান"), () => setStep(2), true)}</View>}
      </>}
    </ScrollView>
  </View>;
}

function MatchNotice({ match, acknowledged, disabled, onAcknowledge }: { match?: RowMatches; acknowledged?: string | null; disabled: boolean; onAcknowledge: (key: string | null) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { lang } = useLanguage();
  const say = (en: string, bn: string) => lang === "bn" ? bn : en;
  if (!match?.total) return null;
  const blocked = match.skuCount > 0 || match.exactNameCount > 0;
  const reviewed = !!match.reviewKey && acknowledged === match.reviewKey;
  return <View style={[s.matchNotice, blocked ? s.matchBlocked : s.matchWarning]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Database matches for row ${match.rowNumber}`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={s.matchToggle}>
      <Ionicons name={blocked ? "alert-circle-outline" : "information-circle-outline"} size={19} color={blocked ? colors.danger : colors.warningText} />
      <View style={s.grow}>
        {match.skuCount > 0 && <Text style={s.error}>{say("SKU matched with database", "ডেটাবেসে SKU মিলে গেছে")}</Text>}
        {match.exactNameCount > 0 && <Text style={s.error}>{say(`${match.exactNameCount} exact product name match(es)`, `${match.exactNameCount}টি পণ্যের নাম হুবহু মিলে গেছে`)}</Text>}
        {match.similarNameCount > 0 && <Text style={s.matchWarningText}>{say(`${match.similarNameCount} similar product names found`, `${match.similarNameCount}টি পণ্যের নাম আংশিক মিলে গেছে`)}{reviewed ? say(" · Reviewed", " · যাচাই করা হয়েছে") : ""}</Text>}
      </View><Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.secondary} />
    </Pressable>
    {expanded && <View style={s.matchDetails}>
      {match.products.slice(0, showAll ? 50 : 5).map(product => <View key={product.id} style={s.matchProduct}>
        <MatchImage url={product.imageUrl} />
        <View style={s.grow}><Text style={s.label}>{product.name}</Text><Text style={s.muted}>{product.sku} · {product.category}</Text>
          <Text style={product.isDeleted ? s.error : s.muted}>{[
            product.skuMatch ? say("Same SKU", "একই SKU") : "",
            product.exactNameMatch ? say("Same name", "একই নাম") : "",
            product.similarNameMatch ? say("Similar name", "কাছাকাছি নাম") : "",
            product.isDeleted ? say("Deleted — SKU reserved", "মুছে ফেলা হয়েছে — SKU সংরক্ষিত") : product.status !== "ACTIVE" ? product.status : "",
          ].filter(Boolean).join(" · ")}</Text>
        </View>
        {!product.isDeleted && <Link href={{ pathname: "/products/[id]", params: { id: product.id } }} target="_blank" asChild><Pressable accessibilityRole="link" style={s.matchLink}><Text style={s.secondaryText}>{say("View Product", "পণ্য দেখুন")}</Text><Ionicons name="open-outline" size={15} color={colors.primaryDark} /></Pressable></Link>}
      </View>)}
      {match.products.length > 5 && <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)}><Text style={s.secondaryText}>{showAll ? say("Show less", "কম দেখুন") : say(`Show more (${match.products.length})`, `আরও দেখুন (${match.products.length})`)}</Text></Pressable>}
      {showAll && match.total > match.products.length && <Text style={s.muted}>{say(`Showing the ${match.products.length} closest matches of ${match.total}.`, `${match.total}টির মধ্যে সবচেয়ে কাছাকাছি ${match.products.length}টি দেখানো হচ্ছে।`)}</Text>}
      {blocked ? <Text style={s.error}>{say("Correct the matching name or SKU, or remove this upload row.", "মিলে যাওয়া নাম বা SKU সংশোধন করুন অথবা আপলোডের সারিটি বাদ দিন।")} </Text> : !!match.reviewKey && <Pressable accessibilityRole="checkbox" accessibilityLabel={`Acknowledge similar names for row ${match.rowNumber}`} accessibilityState={{ checked: reviewed, disabled }} disabled={disabled} onPress={() => onAcknowledge(reviewed ? null : match.reviewKey)} style={s.matchToggle}><Ionicons name={reviewed ? "checkbox" : "square-outline"} size={22} color={colors.primaryDark} /><Text style={s.grow}>{say("I reviewed these matches. This is a different product.", "মিলগুলো যাচাই করেছি। এটি আলাদা পণ্য।")}</Text></Pressable>}
    </View>}
  </View>;
}

function MatchImage({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  const source = url ? (/^https?:\/\//i.test(url) ? url : `${MEDIA_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`) : null;
  return source && !failed ? <Image accessibilityLabel="Matched product" source={{ uri: source }} style={s.matchImage} onError={() => setFailed(true)} /> : <View style={s.matchImage}><Ionicons name="cube-outline" size={24} color={colors.muted} /></View>;
}

function Choice({ label, value, options, onSelect, disabled }: { label: string; value?: string; options: { id: string; name: string }[]; onSelect: (id: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { lang } = useLanguage();
  return <View><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} disabled={disabled} onPress={() => { setOpen(!open); setQuery(""); }} style={s.select}><Text style={s.grow}>{options.find(o => o.id === value)?.name || label}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.secondary} /></Pressable>{open && <View style={s.choices}><TextInput accessibilityLabel={label} placeholder={lang === "bn" ? "খুঁজুন…" : "Search…"} value={query} onChangeText={setQuery} style={s.input} /><ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">{options.filter(o => o.name.toLowerCase().includes(query.toLowerCase())).map(o => <Pressable key={o.id} disabled={disabled} onPress={() => { onSelect(o.id); setOpen(false); }} style={s.option}><Text>{o.name}</Text></Pressable>)}{!options.filter(o => o.name.toLowerCase().includes(query.toLowerCase())).length && <Text style={s.muted}>{lang === "bn" ? "কোনো ফল পাওয়া যায়নি" : "No matching options"}</Text>}</ScrollView></View>}</View>;
}

const s = StyleSheet.create({
  pendingBox: { padding: 14, gap: 10, borderRadius: 10, backgroundColor: colors.warningBackground, borderWidth: 1, borderColor: colors.warning },
  pendingRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  matchNotice: { width: 720, borderBottomWidth: 1, borderColor: colors.divider }, matchBlocked: { backgroundColor: "#FFF5F5" }, matchWarning: { backgroundColor: "#FFFBEB" },
  matchToggle: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }, matchWarningText: { color: colors.warningText, fontSize: 13 }, matchDetails: { paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  matchProduct: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.divider }, matchImage: { width: 46, height: 46, borderRadius: 6, backgroundColor: colors.disabled, alignItems: "center", justifyContent: "center" }, matchLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  root: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.divider },
  content: { padding: 16, gap: 16, paddingBottom: 40, width: "100%", maxWidth: 1100, alignSelf: "center" }, grow: { flex: 1 }, title: { fontSize: 20, fontWeight: "700", color: colors.heading }, muted: { fontSize: 12, color: colors.secondary, lineHeight: 19 }, description: { fontSize: 14, lineHeight: 22, color: colors.secondary },
  steps: { flexDirection: "row", gap: 6 }, step: { flex: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 6, backgroundColor: colors.disabled }, activeStep: { backgroundColor: colors.primaryLight }, stepText: { textAlign: "center", color: colors.secondary, fontSize: 12, fontWeight: "600" }, activeText: { color: colors.primaryDark },
  card: { padding: 20, gap: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider }, icon: { alignSelf: "flex-start", padding: 12, backgroundColor: colors.primaryLight, borderRadius: 12 }, uploadCard: { borderStyle: "dashed", borderColor: colors.primary, alignItems: "center", paddingVertical: 30 },
  button: { minHeight: 46, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }, secondaryButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }, buttonText: { color: colors.white, fontWeight: "700", fontSize: 14 }, secondaryText: { color: colors.primaryDark }, disabled: { opacity: 0.5 },
  divider: { height: 1, backgroundColor: colors.divider }, label: { fontWeight: "600", color: colors.heading, fontSize: 13 }, inline: { flexDirection: "row", alignItems: "center", gap: 10 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, field: { flexGrow: 1, flexBasis: 180, gap: 6 }, input: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, minHeight: 44, paddingHorizontal: 12, color: colors.heading, backgroundColor: colors.white }, select: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }, choices: { padding: 10, gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }, option: { padding: 12, borderBottomWidth: 1, borderColor: colors.divider },
  tablePanel: { borderWidth: 1, borderColor: colors.divider, borderRadius: 12, overflow: "hidden", backgroundColor: colors.white },
  tableToolbar: { padding: 16, gap: 10 }, tableRow: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderColor: colors.divider },
  tableHeading: { backgroundColor: colors.cardSecondary }, columnHeading: { padding: 12, fontSize: 12, fontWeight: "700", color: colors.heading, borderRightWidth: 1, borderColor: colors.divider },
  tableCell: { padding: 3, borderRightWidth: 1, borderColor: colors.divider }, cellInput: { minHeight: 42, paddingHorizontal: 9, borderWidth: 1, borderColor: "transparent", borderRadius: 3, color: colors.heading, fontSize: 14 },
  numericCell: { textAlign: "right" }, rowNumber: { width: 40, justifyContent: "center", alignItems: "center", backgroundColor: colors.disabled, borderRightWidth: 1, borderColor: colors.divider },
  removeCell: { width: 40, alignItems: "center", justifyContent: "center" }, cellError: { color: colors.dangerText, fontSize: 11, padding: 4 },
  invalidInput: { borderColor: colors.danger, backgroundColor: colors.dangerBackground, color: colors.dangerText }, error: { color: colors.dangerText, fontSize: 13, lineHeight: 20 }, errorBox: { backgroundColor: colors.dangerBackground, padding: 14, borderRadius: 10 },
});
