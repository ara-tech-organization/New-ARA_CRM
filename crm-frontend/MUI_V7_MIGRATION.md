# MUI v7 Migration Guide

This document outlines the breaking changes and migration steps for upgrading to Material-UI (MUI) v7.

## Package Versions

Current MUI packages installed:
- `@mui/base`: 5.0.0-beta.70
- `@mui/icons-material`: 7.3.2
- `@mui/joy`: 5.0.0-beta.52
- `@mui/material`: 7.3.2
- `@mui/system`: 7.3.2
- `@mui/x-charts`: 8.11.1
- `@mui/x-date-pickers`: 8.11.1

## Breaking Changes

### 1. Grid Component API Change

**IMPORTANT:** The Grid component API has been completely redesigned in MUI v7.

#### Old Syntax (MUI v6 and earlier)
```jsx
<Grid container spacing={3}>
  <Grid item xs={12} md={8}>
    {/* Content */}
  </Grid>
  <Grid item xs={12} sm={6} md={4} lg={3}>
    {/* Content */}
  </Grid>
</Grid>
```

#### New Syntax (MUI v7)
```jsx
<Grid container spacing={3}>
  <Grid size={{xs: 12, md: 8}}>
    {/* Content */}
  </Grid>
  <Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}>
    {/* Content */}
  </Grid>
</Grid>
```

#### Key Changes:
1. **Remove the `item` prop** - It's no longer needed
2. **Replace individual breakpoint props** - Convert `xs`, `sm`, `md`, `lg`, `xl` props into a single `size` prop
3. **Use object notation** - The `size` prop accepts an object with breakpoint keys
4. **Keep `container` prop unchanged** - No changes to container behavior

#### Examples:

**Simple Grid:**
```jsx
// OLD
<Grid item xs={12}>

// NEW
<Grid size={{xs: 12}}>
```

**Multiple Breakpoints:**
```jsx
// OLD
<Grid item xs={12} sm={6} md={4} lg={3}>

// NEW
<Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}>
```

**With Other Props:**
```jsx
// OLD
<Grid item xs={12} md={8} sx={{ mb: 2 }} key={item.id}>

// NEW
<Grid size={{xs: 12, md: 8}} sx={{ mb: 2 }} key={item.id}>
```

## Migration Completed

All Grid components across the project have been updated to use the new MUI v7 syntax.

### Files Updated (15 total):
1. `frontend/src/pages/AccessManagement.js` - 3 instances
2. `frontend/src/pages/Settings.js` - 16 instances
3. `frontend/src/pages/Leads.js` - 23 instances
4. `frontend/src/pages/Clients.js` - 24 instances
5. `frontend/src/pages/EmailCampaigns.js` - 6 instances
6. `frontend/src/pages/GoogleAds.js` - 8 instances
7. `frontend/src/pages/ClientVault.js` - 16 instances
8. `frontend/src/pages/DailyLeadData.js` - 10 instances
9. `frontend/src/pages/DashboardPro.js` - 11 instances
10. `frontend/src/pages/MetaAds.js` - 6 instances
11. `frontend/src/pages/Reports.js` - 6 instances
12. `frontend/src/pages/FundEntry.js` - 21 instances
13. `frontend/src/pages/DailyEntry.js` - 9 instances
14. `frontend/src/pages/DashboardEnhanced.js` - 8 instances
15. `frontend/src/pages/Dashboard.js` - 18 instances

**Total instances updated:** 185

## Future Development Guidelines

### When Creating New Components

Always use the new MUI v7 Grid syntax:

```jsx
import { Grid } from '@mui/material';

function MyComponent() {
  return (
    <Grid container spacing={3}>
      <Grid size={{xs: 12, md: 6}}>
        {/* Left column */}
      </Grid>
      <Grid size={{xs: 12, md: 6}}>
        {/* Right column */}
      </Grid>
    </Grid>
  );
}
```

### Common Patterns

**Full Width:**
```jsx
<Grid size={{xs: 12}}>
```

**Half Width on Desktop:**
```jsx
<Grid size={{xs: 12, md: 6}}>
```

**Three Columns on Desktop:**
```jsx
<Grid size={{xs: 12, sm: 6, md: 4}}>
```

**Four Columns on Desktop:**
```jsx
<Grid size={{xs: 12, sm: 6, md: 3}}>
```

**Responsive Card Grid:**
```jsx
<Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}>
```

## Deprecation Warnings

### @mui/base Package
The `@mui/base` package (v5.0.0-beta.70) has been replaced by `@base-ui/react` in newer versions. While the current version will continue to work, consider migrating to `@base-ui/react` in future updates.

## Additional Resources

- [MUI v7 Migration Guide](https://mui.com/material-ui/migration/migration-v6/)
- [MUI Grid v7 Documentation](https://mui.com/material-ui/react-grid2/)
- [MUI Changelog](https://github.com/mui/material-ui/releases)

## Notes

- **Date Updated:** 2026-01-27
- **Migration Status:** ✅ Complete
- **Breaking Changes:** Grid component API
- **Backward Compatibility:** None - must use new syntax

---

**Remember:** Always use `<Grid size={{xs: 12, md: 8}}>` instead of `<Grid item xs={12} md={8}>` when working with MUI v7!
