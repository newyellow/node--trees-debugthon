# Radar Design Kit adaptation

Newyellow supplied Taipei_Tree_Radar_Design_Kit.zip (2026-10-24, SHA256 9f6abcea9a1e8d4825c9ea8ece353a78c97d92f4bc4bd425c918c35e1c7bdb85). Reviewed README, design tokens, compact and mobile previews and the six static icon symbols. No supplied scripts were executed; demo-data scores were not imported.

Overview uses forest #014F35, cream #FFFDF4, lime #97CA46, sage grid at25% opacity, straight polygon segments, square measured nodes and five20-point rings. Six pixel icon paths are mapped to existing metric keys, also used by detail headings. Original labels remain tree density, protected records, source-name diversity, native-name proxy, bird/insect DEMO and reporting DEMO; no claims of measured vegetation coverage or complete species surveys. Full accessible names and exact score captions remain.

Existing stars, composite score formula, three actions, map colors, camera/tour/input lifecycle, source data and missing/zero contract are preserved. This is a visual adaptation, not wholesale replacement by the static mock or its no-stars suggestion. Actual values come from the original village data, never the supplied82/54/68/76/61/88 examples. Static paths contain no links/scripts/fonts/images or external sprite dependency.

Verification is changed renderer geometry/icon/unit assertions, one bounded overview/detail render and action presence check, required build and minimal public artifact/health/remote-SHA checks. No model calls, full-suite or viewport matrix.

## Display copy update — 2026-10-24 18:18
Requested names now match both radar axes and detail headings: 綠覆率、受保護樹木量、物種多樣性、原生種比例、鳥類昆蟲、民眾貢獻度. Long labels reduce font size within the existing SVG bounds. Overview/legend/ranking move DEMO wording into village details; both simulated sections explicitly state 「※ 回報互動系統尚未實裝，目前為模擬資料」. Details retain the actual density/count/name-richness/proxy methodology; 綠覆率 is explicitly NOT measured vegetation-cover percentage. Only display labels and rounding change: integer 0–100 score text in radar, cards and strongest metric; underlying scores, polygons, star arithmetic, ranking, raw record counts and stored data are untouched. Existing star display retains one decimal on the distinct 0–5 scale.
Validation: four affected renderer checks, syntax, isolated build, one390×800 actual overview/detail render: six labels withinSVG, six corresponding icons, integer detail scores, two exact disclosures, no DEMO/simulation wording in overview, preserved stars/three actions, zero JS errors. No AI inference or full regression suite.
