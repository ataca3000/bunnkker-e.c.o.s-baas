# ECOS Enterprise Glossary

Authoritative EN ↔ AR terminology for the ECOS platform. Built **incrementally**
— each certified localization batch appends only the terms it introduced.

**Rule:** a business concept has exactly one translation across every module.
Where a term already appears here, reuse it; never re-translate it in a new
namespace. The `common` namespace is the terminology baseline and outranks all
others in a conflict.

**Certification levels:** Verified · Certified · **Enterprise Approved**

| Batch | Domain | Status |
|---|---|---|
| 1 | `common` — Core Platform | **Enterprise Approved** |
| 2 | `channels`, `settings` — Organization | Certified |
| 3.1 | `products` — Commerce | Certified |
| 3.2 | `raw-materials` — Commerce | Certified |

---

## Core platform (Batch 1 — Enterprise Approved)

### Actions
| EN | AR |
|---|---|
| Save | حفظ |
| Cancel | إلغاء |
| Create | إنشاء |
| Edit | تعديل |
| Delete | حذف |
| Confirm | تأكيد |
| Clear | مسح |
| More | المزيد |
| New | جديد |
| View all | عرض الكل |
| Working… | جارٍ التنفيذ… |

### Navigation
| EN | AR |
|---|---|
| Navigation | التنقل |
| Menu | القائمة |
| Close menu | إغلاق القائمة |
| Workspaces | مساحات العمل |
| Module navigation | تنقل الوحدات |
| Expand sidebar | توسيع الشريط الجانبي |
| Collapse sidebar | طي الشريط الجانبي |

### Data grid & selection
| EN | AR |
|---|---|
| Search | بحث |
| Bulk actions | إجراءات جماعية |
| Quick filters | عوامل تصفية سريعة |
| Clear filters | مسح عوامل التصفية |
| Rows | الصفوف |
| Rows per page | عدد الصفوف في الصفحة |
| Previous page / Next page | الصفحة السابقة / الصفحة التالية |
| Selected | المحددة |
| Clear selection | إلغاء التحديد |
| Select all rows | تحديد كل الصفوف |
| Saved views | العروض المحفوظة |
| No results | لا توجد نتائج |

---

## Organization (Batch 2 — Certified)

| EN | AR |
|---|---|
| Brand | العلامة التجارية |
| Brands | العلامات التجارية |
| Company | الشركة |
| Companies | الشركات |
| Channel | القناة |
| Channels | القنوات |
| Platforms | المنصات |
| Zones | المناطق |
| Brand zones | مناطق العلامة التجارية |

---

## Commerce (Batches 3.1–3.2 — Certified)

| EN | AR |
|---|---|
| Products | المنتجات |
| Raw Materials | المواد الخام |
| Recipes | الوصفات |
| Cost History | سجل التكلفة |
| Current Cost | التكلفة الحالية |
| Previous Cost / New Cost | التكلفة السابقة / التكلفة الجديدة |
| Highest Cost / Lowest Cost | أعلى تكلفة / أدنى تكلفة |
| Purchase | شراء |
| Manual | يدوي |

---

## Conventions

**Plural keys.** A key of the form `key` / `key_one` / `key_other` is an approved
i18next pattern. The base key is **required by the type layer** and must never be
removed unless proven obsolete — i18next resolves the suffixed form first when
`count` is supplied, so the base never shadows the plural. Give the base key the
`_other` wording.

**Interpolation.** Preserve `{{variable}}` tokens exactly as they appear in
sibling keys. Never introduce a variable name that no call site supplies.

**Arabic plurals.** Arabic has six plural categories to English's two. Only
author the categories the source file already declares.

**Terminology drift.** Identical business concepts must render identically
across modules — `Brand` is `العلامة التجارية` in a table column, a form label,
and a switcher alike.
