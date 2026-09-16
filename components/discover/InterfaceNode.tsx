"use client";

import { Handle, Position } from "@xyflow/react";
import { INTERFACE_NODE_SIZE } from "@/lib/discover-graph-layout";
import type { DataObject } from "@/lib/types";
import InfoIcon from "@/components/icons/InfoIcon";
import InterfaceInfoCard from "./InterfaceInfoCard";
import { useApplicationInfo } from "./ApplicationInfoContext";

export type InterfaceNodeData = {
  name: string | null;
  protocol: string | null;
  externalId: string | null;
  /** Deduplicated and sorted by the adapter — see `toDataObjects` in
   * `lib/discover-graph-adapter.ts`. */
  dataObjects: DataObject[];
};

/** Small circle node — positioned in a ring around its provider's rectangle
 * by `interfaceSlotPosition`. Too small for inline text; the name (falling
 * back to the protocol, then the node id) is a tooltip only. The info icon at
 * its centre opens the card listing what flows through the interface. */
export default function InterfaceNode({
  id,
  data,
}: Readonly<{ id: string; data: InterfaceNodeData }>) {
  const { openInterfaceId, toggleInterface, close } = useApplicationInfo();
  const label = data.name || data.protocol || "Interface";
  const infoOpen = openInterfaceId === id;

  return (
    <div
      title={label}
      className="relative rounded-full border-2 bg-surface"
      style={{
        width: INTERFACE_NODE_SIZE,
        height: INTERFACE_NODE_SIZE,
        borderColor: "var(--color-accent)",
      }}
    >
      <Handle type="source" position={Position.Left} style={{ visibility: "hidden" }} />
      <Handle type="source" position={Position.Right} style={{ visibility: "hidden" }} />
      <Handle type="target" position={Position.Left} style={{ visibility: "hidden" }} />
      <Handle type="target" position={Position.Right} style={{ visibility: "hidden" }} />
      <button
        type="button"
        // `nodrag` plus the stopped propagation are what keep the click from
        // dragging the circle, highlighting its links or opening the context
        // menu — same arrangement as the application rectangle's info button.
        className="nodrag absolute inset-0 flex items-center justify-center rounded-full text-muted hover:text-accent"
        aria-label={`Interface info: ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleInterface(id);
        }}
      >
        <InfoIcon size={12} />
      </button>
      {infoOpen && (
        <InterfaceInfoCard
          name={data.name}
          protocol={data.protocol}
          dataObjects={data.dataObjects}
          onClose={close}
        />
      )}
    </div>
  );
}
