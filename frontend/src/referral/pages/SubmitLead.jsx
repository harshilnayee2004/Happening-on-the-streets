import Page from '../../shared/components/Page.jsx';
import { referralLinks } from '../../shared/nav.js';

export default function SubmitLead() {
  return (
    <Page
      title="Submit lead"
      lede="Submit a lead you cannot serve. Contact details stay with the person who submitted them."
      links={referralLinks}
    />
  );
}
