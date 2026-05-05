import { useEffect } from 'react';
import Masonry from 'react-masonry-css';
import { useInfiniteQuery } from '@tanstack/react-query';
import { mediaApi } from '../../lib/api';
import { MediaCard } from './MediaCard';
import { useMediaStore } from '../../stores/useMediaStore';
import { Loader2 } from 'lucide-react';
import { MediaGridSkeleton } from '../ui/Skeletons';
import { EmptyState } from '../ui/EmptyState';

export function MediaGrid() {
  const { media, setMedia } = useMediaStore();
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['media'],
    queryFn: ({ pageParam = 1 }) => mediaApi.getMedia(pageParam, 50),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Sync to zustand store (optional, but good if we want global access to mutate)
  useEffect(() => {
    if (data?.pages) {
      const allMedia = data.pages.flatMap((page) => page.data);
      setMedia(allMedia);
    }
  }, [data, setMedia]);

  // Infinite scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop 
        >= document.documentElement.offsetHeight - 500
      ) {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (status === 'pending') {
    return <MediaGridSkeleton count={12} />;
  }

  if (status === 'error') {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-[var(--danger)]">
        <p>Error loading media.</p>
      </div>
    );
  }

  if (media.length === 0) {
    return <EmptyState />;
  }

  const breakpointColumnsObj = {
    default: 4,
    1280: 4,
    1024: 3,
    768: 2,
    500: 1
  };

  return (
    <div className="w-full">
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex w-auto -ml-4" // Masonry uses negative margins
        columnClassName="pl-4 bg-clip-padding"
      >
        {media.map((item) => (
          <div key={item.id} className="mb-4">
            <MediaCard item={item} />
          </div>
        ))}
      </Masonry>
      
      {isFetchingNextPage && (
        <div className="flex h-20 items-center justify-center pb-8 p-4">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
        </div>
      )}
    </div>
  );
}
