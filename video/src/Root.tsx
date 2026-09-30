import React from "react";
import { Composition } from "remotion";
import { AmbiguityDemo } from "./AmbiguityDemo";

export const AmbiguityRoot: React.FC = () => (
  <Composition
    id="AmbiguityDemo"
    component={AmbiguityDemo}
    durationInFrames={2400}
    fps={30}
    width={1920}
    height={1080}
  />
);
