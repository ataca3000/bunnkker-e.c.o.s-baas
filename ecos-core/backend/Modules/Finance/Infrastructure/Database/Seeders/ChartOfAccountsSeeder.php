<?php

declare(strict_types=1);

namespace Modules\Finance\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The official ECOS Chart of Accounts.
 *
 * ┌─ WHY THIS EXISTS ───────────────────────────────────────────────────────┐
 * │ finance_accounts shipped empty, so every posting path terminated in       │
 * │ accountNotFound. The engine could not function on a fresh install — not   │
 * │ because it was wrong, but because it had nothing to post into.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CONTROL ACCOUNTS ARE THE POINT ────────────────────────────────────────┐
 * │ AR, AP, Inventory, VAT and Payroll Liability are marked is_control with a │
 * │ named subledger. JournalEngine already refuses MANUAL journals against a  │
 * │ control account (controlAccountManual), so marking them here is what      │
 * │ makes that guard bite: the GL side of a subledger moves only through the  │
 * │ subledger, never by someone typing a journal.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Every account is either a HEADER (is_postable = false, may have children) or a
 * LEAF (is_postable = true, never a parent). Postings land only on leaves, which
 * is what keeps a rolled-up balance meaningful.
 *
 * IDEMPOTENT: keyed on (company_id, code). Re-running updates nothing that a
 * company has since customised — it only fills what is missing.
 */
class ChartOfAccountsSeeder extends Seeder
{
    /**
     * code, name, name_ar, type, category, normal balance, postable, control subledger
     *
     * Codes follow the conventional 1–5 block: 1 asset, 2 liability, 3 equity,
     * 4 revenue, 5 cost & expense. Parents are derived from the code prefix, so
     * the hierarchy is implied by the numbering rather than maintained twice.
     *
     * @return array<int, array{0:string,1:string,2:string,3:string,4:string,5:string,6:bool,7:?string}>
     */
    public function definitions(): array
    {
        $A = 'asset';
        $L = 'liability';
        $E = 'equity';
        $R = 'revenue';
        $X = 'expense';
        $D = 'debit';
        $C = 'credit';

        return [
            // ── 1 ASSETS ────────────────────────────────────────────────────
            ['1000', 'Assets', 'الأصول', $A, 'current_asset', $D, false, null],

            ['1100', 'Cash & Cash Equivalents', 'النقد وما في حكمه', $A, 'current_asset', $D, false, null],
            ['1110', 'Cash on Hand', 'النقد بالصندوق', $A, 'current_asset', $D, true, null],
            ['1120', 'Petty Cash', 'المصروفات النثرية', $A, 'current_asset', $D, true, null],
            ['1130', 'Cash in Transit', 'نقد في الطريق', $A, 'current_asset', $D, true, null],
            // Takings recorded at the till but not yet reconciled to a deposit.
            // Distinct from Cash in Transit, which is money already on its way to
            // the bank: POS Clearing is cleared by the cash-drawer reconciliation.
            ['1140', 'POS Clearing', 'تسوية نقاط البيع', $A, 'current_asset', $D, true, null],

            ['1200', 'Banks', 'البنوك', $A, 'current_asset', $D, false, null],
            ['1210', 'Bank — Current Accounts', 'البنك — حسابات جارية', $A, 'current_asset', $D, true, null],
            ['1220', 'Bank — Savings Accounts', 'البنك — حسابات توفير', $A, 'current_asset', $D, true, null],

            ['1300', 'Accounts Receivable', 'حسابات العملاء', $A, 'current_asset', $D, false, null],
            // CONTROL: moved only by the AR subledger.
            ['1310', 'Trade Receivables', 'ذمم العملاء', $A, 'current_asset', $D, true, 'receivables'],
            ['1320', 'Employee Receivables', 'ذمم الموظفين', $A, 'current_asset', $D, true, null],
            ['1330', 'Allowance for Doubtful Debts', 'مخصص الديون المشكوك فيها', $A, 'current_asset', $C, true, null],

            ['1400', 'Inventory', 'المخزون', $A, 'current_asset', $D, false, null],
            // CONTROL: moved only by inventory postings.
            ['1410', 'Finished Goods', 'بضاعة تامة الصنع', $A, 'current_asset', $D, true, 'inventory'],
            ['1420', 'Raw Materials', 'المواد الخام', $A, 'current_asset', $D, true, 'inventory'],
            ['1430', 'Work In Progress', 'إنتاج تحت التشغيل', $A, 'current_asset', $D, true, 'inventory'],
            ['1440', 'Packaging Materials', 'مواد التعبئة والتغليف', $A, 'current_asset', $D, true, 'inventory'],
            ['1450', 'Goods In Transit', 'بضاعة في الطريق', $A, 'current_asset', $D, true, null],
            ['1460', 'Inventory Adjustments Clearing', 'تسويات المخزون', $A, 'current_asset', $D, true, null],

            ['1500', 'Prepayments & Other Current Assets', 'مصروفات مقدمة وأصول أخرى', $A, 'current_asset', $D, false, null],
            ['1510', 'Prepaid Expenses', 'مصروفات مدفوعة مقدماً', $A, 'current_asset', $D, true, null],
            ['1520', 'Supplier Advances', 'دفعات مقدمة للموردين', $A, 'current_asset', $D, true, null],
            ['1530', 'VAT Receivable (Input)', 'ضريبة القيمة المضافة — مدخلات', $A, 'current_asset', $D, true, 'vat'],

            ['1800', 'Non-Current Assets', 'أصول غير متداولة', $A, 'non_current_asset', $D, false, null],
            ['1810', 'Property, Plant & Equipment', 'أصول ثابتة', $A, 'non_current_asset', $D, true, null],
            ['1820', 'Vehicles', 'سيارات ومركبات', $A, 'non_current_asset', $D, true, null],
            ['1830', 'Accumulated Depreciation', 'مجمع الإهلاك', $A, 'non_current_asset', $C, true, null],

            // ── 2 LIABILITIES ───────────────────────────────────────────────
            ['2000', 'Liabilities', 'الالتزامات', $L, 'current_liability', $C, false, null],

            ['2100', 'Accounts Payable', 'حسابات الموردين', $L, 'current_liability', $C, false, null],
            // CONTROL: moved only by the AP subledger.
            ['2110', 'Trade Payables', 'ذمم الموردين', $L, 'current_liability', $C, true, 'payables'],
            ['2120', 'Goods Received Not Invoiced', 'بضاعة مستلمة غير مفوترة', $L, 'current_liability', $C, true, null],
            ['2130', 'Shipping Payables', 'ذمم شركات الشحن', $L, 'current_liability', $C, true, null],

            ['2200', 'Tax Liabilities', 'التزامات ضريبية', $L, 'current_liability', $C, false, null],
            ['2210', 'VAT Payable (Output)', 'ضريبة القيمة المضافة — مخرجات', $L, 'current_liability', $C, true, 'vat'],
            ['2220', 'Withholding Tax Payable', 'ضريبة خصم وتحصيل', $L, 'current_liability', $C, true, null],
            ['2230', 'Income Tax Payable', 'ضريبة الدخل المستحقة', $L, 'current_liability', $C, true, null],

            ['2300', 'Payroll Liabilities', 'التزامات الأجور', $L, 'current_liability', $C, false, null],
            // CONTROL: moved only by payroll postings.
            ['2310', 'Salaries Payable', 'رواتب مستحقة', $L, 'current_liability', $C, true, 'payroll'],
            ['2320', 'Employee Deductions Payable', 'استقطاعات الموظفين', $L, 'current_liability', $C, true, 'payroll'],
            ['2330', 'Employer Contributions Payable', 'مساهمات صاحب العمل', $L, 'current_liability', $C, true, 'payroll'],
            ['2340', 'Social Insurance Payable', 'التأمينات الاجتماعية', $L, 'current_liability', $C, true, 'payroll'],

            ['2400', 'Customer Obligations', 'التزامات تجاه العملاء', $L, 'current_liability', $C, false, null],
            ['2410', 'Customer Deposits', 'دفعات مقدمة من العملاء', $L, 'current_liability', $C, true, null],
            ['2420', 'Deferred Revenue', 'إيرادات مؤجلة', $L, 'current_liability', $C, true, null],
            ['2430', 'Loyalty Points Liability', 'التزام نقاط الولاء', $L, 'current_liability', $C, true, null],
            ['2440', 'Refunds Payable', 'مبالغ مستحقة الرد', $L, 'current_liability', $C, true, null],

            ['2500', 'Accruals & Other', 'مستحقات وأخرى', $L, 'current_liability', $C, false, null],
            ['2510', 'Accrued Expenses', 'مصروفات مستحقة', $L, 'current_liability', $C, true, null],

            ['2800', 'Non-Current Liabilities', 'التزامات طويلة الأجل', $L, 'non_current_liability', $C, false, null],
            ['2810', 'Long-Term Loans', 'قروض طويلة الأجل', $L, 'non_current_liability', $C, true, null],

            // ── 3 EQUITY ────────────────────────────────────────────────────
            ['3000', 'Equity', 'حقوق الملكية', $E, 'equity', $C, false, null],
            ['3100', 'Share Capital', 'رأس المال', $E, 'equity', $C, true, null],
            ['3200', 'Additional Paid-In Capital', 'علاوة إصدار', $E, 'equity', $C, true, null],
            // Year-end closing posts the period result here.
            ['3300', 'Retained Earnings', 'أرباح مرحلة', $E, 'equity', $C, true, null],
            ['3400', 'Current Year Result', 'نتيجة العام الحالي', $E, 'equity', $C, true, null],
            ['3500', 'Owner Drawings', 'مسحوبات الملاك', $E, 'equity', $D, true, null],

            // ── 4 REVENUE ───────────────────────────────────────────────────
            ['4000', 'Revenue', 'الإيرادات', $R, 'operating_revenue', $C, false, null],
            ['4100', 'Sales Revenue', 'إيرادات المبيعات', $R, 'operating_revenue', $C, false, null],
            ['4110', 'Product Sales', 'مبيعات المنتجات', $R, 'operating_revenue', $C, true, null],
            ['4120', 'POS Sales', 'مبيعات نقاط البيع', $R, 'operating_revenue', $C, true, null],
            ['4130', 'Online Sales', 'المبيعات الإلكترونية', $R, 'operating_revenue', $C, true, null],
            ['4140', 'Shipping Revenue', 'إيرادات الشحن', $R, 'operating_revenue', $C, true, null],

            // Contra-revenue: debit balances that reduce the top line.
            ['4200', 'Revenue Deductions', 'مخصومات الإيراد', $R, 'operating_revenue', $D, false, null],
            ['4210', 'Sales Returns', 'مردودات المبيعات', $R, 'operating_revenue', $D, true, null],
            ['4220', 'Sales Discounts', 'خصومات المبيعات', $R, 'operating_revenue', $D, true, null],
            ['4230', 'Coupon Redemptions', 'استخدام الكوبونات', $R, 'operating_revenue', $D, true, null],
            ['4240', 'Loyalty Redemptions', 'استبدال نقاط الولاء', $R, 'operating_revenue', $D, true, null],

            ['4900', 'Other Revenue', 'إيرادات أخرى', $R, 'other_revenue', $C, false, null],
            ['4910', 'Other Income', 'إيرادات متنوعة', $R, 'other_revenue', $C, true, null],
            ['4920', 'Inventory Gain', 'أرباح جرد المخزون', $R, 'other_revenue', $C, true, null],

            // ── 5 COST OF SALES & EXPENSES ──────────────────────────────────
            ['5000', 'Cost of Sales', 'تكلفة المبيعات', $X, 'cost_of_sales', $D, false, null],
            ['5100', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة', $X, 'cost_of_sales', $D, true, null],
            ['5110', 'Material Cost', 'تكلفة المواد', $X, 'cost_of_sales', $D, true, null],
            ['5120', 'Production Labour', 'أجور الإنتاج', $X, 'cost_of_sales', $D, true, null],
            ['5130', 'Manufacturing Overhead', 'أعباء صناعية', $X, 'cost_of_sales', $D, true, null],
            ['5140', 'Production Variance', 'انحرافات الإنتاج', $X, 'cost_of_sales', $D, true, null],
            ['5150', 'Scrap & Rework', 'الهالك وإعادة التشغيل', $X, 'cost_of_sales', $D, true, null],
            ['5160', 'Inventory Write-Off', 'إعدام مخزون', $X, 'cost_of_sales', $D, true, null],
            ['5170', 'Inventory Loss', 'عجز جرد المخزون', $X, 'cost_of_sales', $D, true, null],
            ['5180', 'Purchase Price Variance', 'انحراف سعر الشراء', $X, 'cost_of_sales', $D, true, null],

            ['5500', 'Operating Expenses', 'المصروفات التشغيلية', $X, 'operating_expense', $D, false, null],
            ['5510', 'Salaries & Wages', 'الرواتب والأجور', $X, 'operating_expense', $D, true, null],
            ['5520', 'Employer Contributions', 'مساهمات صاحب العمل', $X, 'operating_expense', $D, true, null],
            ['5530', 'Employee Bonuses', 'مكافآت الموظفين', $X, 'operating_expense', $D, true, null],
            ['5540', 'Sales Commissions', 'عمولات المبيعات', $X, 'operating_expense', $D, true, null],
            ['5550', 'Shipping & Delivery', 'مصروفات الشحن والتوصيل', $X, 'operating_expense', $D, true, null],
            ['5560', 'Marketing & Advertising', 'التسويق والإعلان', $X, 'operating_expense', $D, true, null],
            ['5570', 'Rent', 'إيجارات', $X, 'operating_expense', $D, true, null],
            ['5580', 'Utilities', 'مرافق', $X, 'operating_expense', $D, true, null],
            ['5590', 'Depreciation', 'الإهلاك', $X, 'operating_expense', $D, true, null],

            ['5700', 'Administrative Expenses', 'مصروفات إدارية', $X, 'operating_expense', $D, false, null],
            ['5710', 'Office Expenses', 'مصروفات مكتبية', $X, 'operating_expense', $D, true, null],
            ['5720', 'Professional Fees', 'أتعاب مهنية', $X, 'operating_expense', $D, true, null],
            ['5730', 'Bank Charges', 'مصاريف بنكية', $X, 'operating_expense', $D, true, null],

            ['5900', 'Other Expenses', 'مصروفات أخرى', $X, 'other_expense', $D, false, null],
            ['5910', 'Bad Debt Expense', 'ديون معدومة', $X, 'other_expense', $D, true, null],
            ['5920', 'Write-Offs', 'إعدامات', $X, 'other_expense', $D, true, null],
            ['5930', 'Delivery Failure Cost', 'تكلفة فشل التسليم', $X, 'other_expense', $D, true, null],
            // The cost of points EARNED, recognised when the obligation arises.
            // Redemption is settled against 2430 Loyalty Points Liability and
            // reported through 4240 Loyalty Redemptions — earning and redeeming
            // are different events and must not share an account.
            //
            // Placed under 5900 because 5510–5590 are fully allocated and a code
            // that does not end in 0 would be left without a parent by the
            // hierarchy derivation below.
            ['5940', 'Loyalty Expense', 'مصروف نقاط الولاء', $X, 'other_expense', $D, true, null],
        ];
    }

    public function run(): void
    {
        foreach (DB::table('companies')->pluck('id') as $companyId) {
            $this->seedCompany((string) $companyId);
        }
    }

    /** Seed one company. Safe to call repeatedly. */
    public function seedCompany(string $companyId): int
    {
        $now = now();
        $created = 0;

        // Codes already present for this company — the idempotency key.
        $existing = DB::table('finance_accounts')
            ->where('company_id', $companyId)
            ->pluck('id', 'code')
            ->all();

        foreach ($this->definitions() as [$code, $name, $nameAr, $type, $category, $normal, $postable, $subledger]) {
            if (isset($existing[$code])) {
                continue;
            }

            $id = DB::table('finance_accounts')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'company_id' => $companyId,
                'code' => $code,
                'name' => $name,
                'name_ar' => $nameAr,
                'account_type' => $type,
                'account_category' => $category,
                'normal_balance' => $normal,
                'parent_id' => null,
                'is_postable' => $postable,
                'is_control' => $subledger !== null,
                'control_subledger' => $subledger,
                'currency' => (string) config('finance.ledger.base_currency'),
                'is_active' => true,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $existing[$code] = $id;
            $created++;
        }

        $this->linkHierarchy($companyId);

        return $created;
    }

    /**
     * Derive parent_id from the code numbering.
     *
     * A 4-digit leaf like 1310 belongs to 1300; a 3-block header like 1300
     * belongs to 1000. Deriving it from the code rather than storing the tree
     * twice means the hierarchy cannot contradict the numbering.
     */
    private function linkHierarchy(string $companyId): void
    {
        $byCode = DB::table('finance_accounts')
            ->where('company_id', $companyId)
            ->pluck('id', 'code')
            ->all();

        foreach ($byCode as $code => $id) {
            $parentCode = $this->parentCodeOf((string) $code);

            if ($parentCode === null || ! isset($byCode[$parentCode])) {
                continue;
            }

            DB::table('finance_accounts')
                ->where('id', $id)
                ->whereNull('parent_id')
                ->update(['parent_id' => $byCode[$parentCode]]);
        }
    }

    private function parentCodeOf(string $code): ?string
    {
        if (strlen($code) !== 4) {
            return null;
        }

        // 1310 → 1300 ; 1300 → 1000 ; 1000 → root
        if (! str_ends_with($code, '0')) {
            return null;
        }

        if (substr($code, 2) !== '00') {
            return substr($code, 0, 2).'00';
        }

        if (substr($code, 1) !== '000') {
            return $code[0].'000';
        }

        return null;
    }
}
