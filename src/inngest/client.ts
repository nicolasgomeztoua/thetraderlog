import { EventSchemas, Inngest } from "inngest";

// Define event types for type safety
type Events = {
	"import/process": {
		data: {
			tradeIds: number[];
			userId: number;
		};
	};
};

// Create the Inngest client
export const inngest = new Inngest({
	id: "edgejournal",
	schemas: new EventSchemas().fromRecord<Events>(),
});
