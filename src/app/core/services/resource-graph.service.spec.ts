import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ResourceGraphService } from './resource-graph.service';

describe('ResourceGraphService', () => {
  let service: ResourceGraphService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ResourceGraphService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ResourceGraphService);
  });

  it('queryAllResources paginates across fetch skip tokens', async () => {
    const fetchSpy = spyOn(window, 'fetch');
    fetchSpy.and.returnValues(
      Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'a' }], $skipToken: 'next' }), { status: 200 })),
      Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'b' }] }), { status: 200 })),
    );

    const result = await service.queryAllResources(['sub1']).toPromise();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result?.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('queryStorageSubResources falls back when first query fails', async () => {
    const fetchSpy = spyOn(window, 'fetch');
    fetchSpy.and.returnValues(
      Promise.resolve(new Response('fail', { status: 500 })),
      Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'ok' }] }), { status: 200 })),
    );

    const result = await service.queryStorageSubResources(['sub1']);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('ok');
  });
});
