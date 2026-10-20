import type { IClientExtractor } from './IClientExtractor';
import { ListClientExtractor } from './ListClientExtractor';
import { DetailClientExtractor } from './DetailClientExtractor';
import type { PageType } from '../../shared/constants';

export class ExtractorFactory {
    static create(pageType: PageType): IClientExtractor {
        if (pageType === 'leadsDetail') {
            return new DetailClientExtractor();
        }
        if (pageType === 'todo') {
            return new ListClientExtractor('todo');
        }
        return new ListClientExtractor('leadsList');
    }
}