import type { ColumnsInput } from "../../schema/modules";

export const columnsDemo = {
  id: "do-dont",
  type: "columns",
  title: "Client emails: do and don't",
  content: {
    columns: [
      {
        id: "do",
        title: "Do",
        text: "- Lead with the number that changed\n- Say what you will do next\n- Keep it under 150 words",
      },
      {
        id: "dont",
        title: "Don't",
        text: "- Paste raw platform exports\n- Hide bad news at the end\n- Promise results you cannot control",
      },
    ],
  },
} satisfies ColumnsInput;
