# 🎯 Quick Start - AI Product Classification

## What's Ready to Use Right Now

### 1. **Inventory Form - New AI Button**
Location: Dashboard → Inventory → "AGREGAR NUEVO PRODUCTO" (or edit existing)

```
┌─────────────────────────────────────────┐
│ NUEVO PRODUCTO                       [X] │
├─────────────────────────────────────────┤
│ NOMBRE                                  │
│ [Tubería 3/4" PVC...] [✨ Clasificar] │ ← NEW!
│                                         │
│ After clicking Clasificar:              │
│                                         │
│ ┌─ 💡 Sugerencia de Clasificación ─┐   │
│ │                                  │   │
│ │ Categoría: Fontanería           │   │
│ │ Subcategoría: Tuberías          │   │
│ │ Material: PVC                   │   │
│ │ Medida: 3/4"                    │   │
│ │                                  │   │
│ │ Confianza: ████████░ 92%        │   │
│ │                                  │   │
│ │ [✓ Usar Sugerencia] [X]         │   │
│ └──────────────────────────────────┘   │
│                                         │
│ SECCIÓN: [Fontanería] ← Auto-filled    │
│ PRECIO: [___]                          │
│ STOCK: [___]                           │
│ [💾 GUARDAR]                           │
└─────────────────────────────────────────┘
```

## Try These Products

### Test Case 1: Plumbing Item ✓
**Name:** Tubería 3/4" PVC cromada
**Expected:** Category → Fontanería, Material → PVC, Measure → 3/4"

### Test Case 2: Hardware ✓
**Name:** Tornillo acero galvanizado 1/2"
**Expected:** Category → Tornillería, Material → acero galvanizado, Measure → 1/2"

### Test Case 3: Electrical ✓
**Name:** Cable eléctrico 12 AWG cobre
**Expected:** Category → Eléctrico, Material → cobre, Measure → 12 AWG

### Test Case 4: Tools ✓
**Name:** Llave inglesa de acero 12"
**Expected:** Category → Herramientas, Material → acero

### Test Case 5: Construction ✓
**Name:** Cemento construcción 50kg
**Expected:** Category → Construcción

## How It Works

1. **Click "Clasificar"** → Button shows loading spinner
2. **Wait for analysis** → ~100ms for local classification
3. **See suggestions** → Card shows category + material + confidence
4. **Click "Use Suggestion"** → Auto-fills category field
5. **Continue normally** → Complete product creation
6. **Check history** → Firestore logs each classification

## What Gets Saved

### In Product:
```javascript
{
  name: "Tubería 3/4\" PVC",
  category: "Fontanería",  // ← Set by AI
  price: 250,
  stock: 100,
  // ... other fields
}
```

### In Firestore (ai_classifications):
```javascript
{
  input: { name: "Tubería 3/4\" PVC" },
  result: {
    category: "Fontanería",
    subcategory: "Tuberías",
    material: "PVC",
    measure: "3/4\"",
    confidence: 0.92,
    source: "local"
  },
  timestamp: "2024-01-15T10:30:00Z"
}
```

## Confidence Scores

- 🟢 **90-100%** - High confidence - Trust it
- 🟡 **70-89%** - Good confidence - Likely correct
- 🟠 **50-69%** - Fair confidence - Review it
- 🔴 **Below 50%** - Low confidence - Edit manually

## Features

✨ **Smart Categorization**
- 40+ keyword rules learned from construction industry
- Supports Spanish product names
- Detects materials (PVC, acero, cobre, etc.)
- Extracts measurements (3/4", 1/2", mm, cm)

⚡ **Offline Capable**
- Works without internet
- No external API required
- Instant local classification

🔄 **Optional Remote API**
- Set `AI_SERVICE_URL` env var for advanced classification
- Automatic fallback to local if remote fails

📊 **Full Audit Trail**
- Every classification logged in Firestore
- Historical tracking enabled
- User can see what AI decided

## Troubleshooting

### Button Disabled?
- Name field is empty - type a product name first

### Error "Error al clasificar"?
- Check browser console (F12)
- Ensure you're logged in as admin
- Check Firebase Firestore access

### Suggestion not appearing?
- Wait a moment (API response time)
- Check network tab for `classify-product` request
- Try refreshing page

### Wrong category suggested?
- Confidence score may be low
- Manually select correct category
- Classification feedback will improve future results

## Advanced Usage

### For Developers

**Call classification directly from code:**
```typescript
import { classifyProduct } from '@/lib/ai/classifyProduct';

const result = await classifyProduct("Tubería 3/4\" PVC");
console.log(result.category);      // "Fontanería"
console.log(result.confidence);    // 0.92
```

**Import the classifier service:**
```typescript
import { classifyProductText } from '@/lib/ai/productClassifier';

const result = await classifyProductText(
  "Tornillo acero galvanizado",
  "Tornillo de 1/2 pulgada con cabeza hexagonal"
);
```

### Configuration

Add to `.env.local`:
```bash
# Optional - use external AI service
AI_SERVICE_URL=https://api.myservice.com/classify

# Leave blank to use local rules only
```

## What's Happening Behind the Scenes

```
User clicks "Clasificar"
           ↓
Frontend calls: POST /api/ai/classify-product
           ↓
Backend receives product name
           ↓
Check if AI_SERVICE_URL set:
  - Yes → Call external API
  - No → Use local keyword matching
           ↓
Match against keyword rules:
  - Category keywords (40+ rules)
  - Material keywords (6 types)
  - Measurement patterns (regex)
           ↓
Calculate confidence score
           ↓
Save to Firestore ai_classifications
           ↓
Return result to frontend
           ↓
Display suggestion card in UI
           ↓
User clicks "Use Suggestion"
           ↓
Form category field auto-filled
```

## What's Next?

### Upcoming Features (Optional):
- [ ] Batch import - classify 100s of products at once
- [ ] Classifier accuracy dashboard - see how well AI performs
- [ ] Custom rules - train AI on your specific products
- [ ] Multi-language - Spanish + English + more

## Support

For detailed information, see:
- 📖 `AI_CLASSIFICATION_IMPLEMENTATION_SUMMARY.md` - Full technical guide
- ✅ `AI_CLASSIFICATION_FINAL_CHECKLIST.md` - Implementation checklist

---

## Ready? 🚀

1. Go to Dashboard → Inventory
2. Click "AGREGAR NUEVO PRODUCTO"
3. Type a product name
4. Click "✨ Clasificar"
5. Review the suggestion
6. Click "✓ Usar Sugerencia"
7. Enjoy automatic product categorization!

**That's it! Start classifying products now.** 💡

---

Last Updated: January 2024  
Status: ✅ Production Ready
