import type { Meta, StoryObj } from "@storybook/react-vite";
import { PdfPane } from "./PdfPane";

/** Tiny valid one-page PDF ("Hello") for the rendered state. */
const MINIMAL_PDF = new TextEncoder().encode(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 24 Tf 72 720 Td (UeceTexLive) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
trailer<</Size 5/Root 1 0 R>>
%%EOF`,
);

const meta = {
  title: "Preview/PdfPane",
  component: PdfPane,
} satisfies Meta<typeof PdfPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {
  args: { pdf: null, compiling: false },
};

export const Rendered: Story = {
  args: { pdf: MINIMAL_PDF, compiling: false },
};

export const StaleWhileCompiling: Story = {
  args: { pdf: MINIMAL_PDF, compiling: true },
};
