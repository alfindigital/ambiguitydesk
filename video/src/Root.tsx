import React from "react";
import { Composition } from "remotion";
import { AmbiguityDemo } from "./AmbiguityDemo";

export const AmbiguityRoot: React.FC = () => (
  <Composition
    id="AmbiguityDemo"
    component={AmbiguityDemo}
    durationInFrames={1600}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ voDir: "" }}
  />
);
