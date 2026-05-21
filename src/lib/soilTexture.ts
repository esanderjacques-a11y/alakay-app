export type TextureInput = {
  sand: number;
  silt: number;
  clay: number;
};

export type TextureResult = {
  className: string;
  explanation: string;
};

function closeTo100(total: number) {
  return total >= 98 && total <= 102;
}

export function calculateSoilTexture({
  sand,
  silt,
  clay,
}: TextureInput): TextureResult | null {
  const total = sand + silt + clay;

  if (!closeTo100(total)) {
    return {
      className: "Invalid texture data",
      explanation:
        "Sand, silt, and clay should add close to 100%. Check the entered values.",
    };
  }

  if (clay >= 40 && sand <= 45 && silt <= 40) {
    return {
      className: "Clay",
      explanation:
        "Clay soils usually retain more water and nutrients, but may have drainage, aeration, and compaction problems.",
    };
  }

  if (clay >= 35 && sand > 45) {
    return {
      className: "Sandy clay",
      explanation:
        "Sandy clay has high clay content but more sand influence. It may retain nutrients but can still have structural limitations.",
    };
  }

  if (clay >= 35 && silt > 40) {
    return {
      className: "Silty clay",
      explanation:
        "Silty clay can retain water and nutrients well but may have poor structure and drainage if compacted.",
    };
  }

  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) {
    return {
      className: "Clay loam",
      explanation:
        "Clay loam has moderate to high nutrient and water retention, but compaction and drainage should be monitored.",
    };
  }

  if (clay >= 27 && clay < 40 && sand <= 20) {
    return {
      className: "Silty clay loam",
      explanation:
        "Silty clay loam can be productive but may be sensitive to compaction and poor drainage.",
    };
  }

  if (clay >= 20 && clay < 35 && sand > 45) {
    return {
      className: "Sandy clay loam",
      explanation:
        "Sandy clay loam has moderate retention and better drainage than heavier clay soils.",
    };
  }

  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) {
    return {
      className: "Loam",
      explanation:
        "Loam is generally balanced, with good water retention, drainage, aeration, and nutrient-holding capacity.",
    };
  }

  if (silt >= 50 && clay >= 12 && clay < 27) {
    return {
      className: "Silt loam",
      explanation:
        "Silt loam can be productive and retain water well, but may be vulnerable to crusting and erosion.",
    };
  }

  if (silt >= 80 && clay < 12) {
    return {
      className: "Silt",
      explanation:
        "Silt has high water-holding capacity but can be prone to crusting, erosion, and compaction.",
    };
  }

  if (sand >= 70 && clay < 15) {
    return {
      className: "Sandy loam",
      explanation:
        "Sandy loam drains relatively well but may require more frequent irrigation and nutrient management.",
    };
  }

  if (sand >= 85 && clay < 10 && silt < 15) {
    return {
      className: "Sand",
      explanation:
        "Sandy soils drain quickly and usually have low nutrient and water retention.",
    };
  }

  if (sand >= 70 && sand < 90 && clay < 15) {
    return {
      className: "Loamy sand",
      explanation:
        "Loamy sand drains quickly and has low to moderate water and nutrient retention.",
    };
  }

  return {
    className: "Texture class not classified",
    explanation:
      "The values are valid, but the simplified texture logic could not classify this combination. A USDA texture triangle check is recommended.",
  };
}